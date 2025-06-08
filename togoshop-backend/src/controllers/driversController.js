const Driver = require('../models/Driver');
const Order = require('../models/Order'); // Ajouté pour les requêtes sur Order
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendNotification } = require('../services/notifications'); // Ajouté pour les notifications
const { groupOrders } = require('../services/optimizer'); // Ajouté pour le groupage
const { GroupOrders } = require('../services/optimizer');
const loyaltyController = require('./loyaltyController');
const { roundToTwoDecimals } = require('../services/numberUtils');
const mongoose = require('mongoose'); 
require('dotenv').config();



// Inscription d'un nouveau livreur
exports.registerDriver = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est un administrateur
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur' });
    }

    const { name, email, password, phoneNumber, vehicleDetails } = req.body;

    // Vérifier les champs requis
    if (!name || !email || !password || !phoneNumber) {
      return res.status(400).json({ message: 'Nom, email, mot de passe et numéro de téléphone requis' });
    }

    // Vérifier que l’email n’est pas déjà utilisé
    const existingDriver = await Driver.findOne({ email });
    if (existingDriver) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Créer le livreur
    const driver = new Driver({
      name,
      email,
      password,
      phoneNumber,
      vehicleDetails,
      status: 'offline',
      isDiscoverable: false,
    });

    await driver.save();

    res.status(201).json({ message: 'Livreur créé avec succès', driver });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l’inscription du livreur', error: error.message });
  }
};

// Connexion d’un livreur
exports.loginDriver = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérifier les champs
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    // Trouver le livreur
    const driver = await Driver.findOne({ email });
    if (!driver) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, driver.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Mettre à jour le statut
    driver.status = 'available';
    await driver.save();

    // Générer un token JWT
    const token = jwt.sign(
      { id: driver._id, role: 'driver' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({ token, driver });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la connexion', error: error.message });
  }
};

// Récupérer les informations du livreur connecté
exports.getDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id);
    if (!driver) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }
    driver.earnings = roundToTwoDecimals(driver.earnings);
    res.status(200).json(driver);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des informations', error: error.message });
  }
};

// Mettre à jour la position du livreur
exports.updateDriverLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    // Vérifier les champs
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'Coordonnées (lat, lng) invalides' });
    }

    const driver = await Driver.findById(req.user.id);
    if (!driver) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    // Vérifier que l’utilisateur est un livreur
    if (req.user.role !== 'driver') {
      return res.status(403).json({ message: 'Accès réservé aux livreurs' });
    }

    driver.currentLocation = { lat, lng };
    await driver.save();

    res.status(200).json({ message: 'Position mise à jour avec succès', currentLocation: driver.currentLocation });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la position', error: error.message });
  }
};

// Activer/Désactiver la détectabilité du livreur
exports.toggleDiscoverable = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id);
    if (!driver) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    if (req.user.role !== 'driver') {
      return res.status(403).json({ message: 'Accès réservé aux livreurs' });
    }

    driver.isDiscoverable = !driver.isDiscoverable;
    await driver.save();

    res.status(200).json({ message: `Détectabilité ${driver.isDiscoverable ? 'activée' : 'désactivée'}`, isDiscoverable: driver.isDiscoverable });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la détectabilité', error: error.message });
  }
};

// Récupérer la position d’un livreur (pour le suivi client)
exports.getDriverLocation = async (req, res) => {
  try {
    // Vérifier que l’utilisateur est un client
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Accès réservé aux clients' });
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    if (!driver.currentLocation) {
      return res.status(404).json({ message: 'Position du livreur non disponible' });
    }

    res.status(200).json({ currentLocation: driver.currentLocation });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la position', error: error.message });
  }
};

// Accepter une commande
exports.acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const driver = await Driver.findById(req.user.id);
    if (!driver || driver.status !== 'available') {
      return res.status(400).json({ message: 'Livreur non disponible ou non trouvé' });
    }

    let order = await Order.findById(orderId);
    if (!order || order.status !== 'validated') {
      return res.status(404).json({ message: 'Commande non trouvée ou non valide' });
    }

    order.status = 'ready_for_pickup';
    order.driverId = driver._id;
    order.zoneId = order._id.toString(); // Première commande définit la zone
    order.acceptedAt = new Date(); // Marquer l’acceptation
    await order.save();

    driver.status = 'pending_pickup'; // Permettre le groupage
    await driver.save();

    // Regrouper les commandes si possible
    const groupedCount = await groupOrders(driver._id, orderId);
    res.status(200).json({ message: `Commande acceptée, ${groupedCount} commande(s) assignée(s)`, order });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l’acceptation', error: error.message });
  }
};

// Rejeter une commande
exports.rejectOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const driver = await Driver.findById(req.user.id);
    if (!driver) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    let order = await Order.findById(orderId);
    if (!order || order.status !== 'validated') {
      return res.status(404).json({ message: 'Commande non trouvée ou non valide' });
    }

    order.status = 'validated';
    order.priority = 1; // Haute priorité après refus
    order.driverId = null;
    order.zoneId = '';
    await order.save();

    res.status(200).json({ message: 'Commande rejetée', order });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du rejet', error: error.message });
  }
};

// Mettre à jour le statut de la commande (par le livreur)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const driver = await Driver.findById(req.user.id);
    if (!driver) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    let order = await Order.findById(orderId);
    if (!order || order.driverId.toString() !== driver._id.toString()) {
      return res.status(403).json({ message: 'Accès non autorisé à cette commande' });
    }

    const validTransitions = {
      'ready_for_pickup': ['in_delivery'],
      'in_delivery': ['delivered'],
    };
    if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
      return res.status(400).json({ message: `Transition de statut invalide de ${order.status} à ${status}` });
    }

    order.status = status;
    if (status === 'in_delivery') {
      driver.status = 'busy'; // Plus de nouvelles commandes possibles
      await driver.save();
    } else if (status === 'delivered') {
      order.clientValidation = false; // Attendre la validation client
      await sendNotification(order.clientId, `Votre commande (${orderId}) a été livrée. Veuillez valider avec le code : ${order.validationCode}`);

      // Ajout des points de fidélité pour le client
      const points = Math.floor(order.totalAmount / 2000);
      console.log(`Ajout de ${points} points de fidélité pour la commande ${orderId} avec montant ${order.totalAmount}`);
      try {
        await loyaltyController.addPoints(
          {
            user: { id: order.clientId.toString(), role: 'client' },
            body: {
              points: points,
              description: `Commande livrée (ID: ${order._id})`,
              fromOrder: true,
            },
          },
          {
            status: (code) => ({ json: (data) => console.log('Réponse ajout points:', data) }),
            json: (data) => console.log('Réponse ajout points:', data),
          }
        );
        console.log(`Points ajoutés avec succès pour l'utilisateur ${order.clientId}`);
      } catch (error) {
        console.error('Erreur lors de l’ajout des points:', error.message);
      }

      // Mise à jour des earnings du livreur
      if (order.driverId) {
        const driver = await Driver.findOne({ _id: new mongoose.Types.ObjectId(order.driverId) });
        if (driver) {
          driver.status = 'available';
          driver.earnings = roundToTwoDecimals((driver.earnings || 0) + order.deliveryFee);
          await driver.save();
          console.log(`Livreur mis à jour: ${driver._id}, status: ${driver.status}, earnings: ${driver.earnings}`);
        } else {
          console.log(`Livreur non trouvé pour driverId: ${order.driverId}`);
        }
      }
    }
    await order.save();

    // Vérifier si toutes les commandes du livreur sont livrées et validées
    if (status === 'delivered') {
      const remainingOrders = await Order.countDocuments({
        driverId: driver._id,
        status: { $in: ['ready_for_pickup', 'in_delivery', 'delivered'] },
        clientValidation: false,
      });
      if (remainingOrders === 0) {
        driver.status = 'available'; // Toutes les commandes sont validées
        await driver.save();
      }
    }

    res.status(200).json({ message: 'Statut mis à jour', order });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut', error: error.message });
  }
};

// Signaler un problème de validation client
exports.reportDeliveryIssue = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const driver = await Driver.findById(req.user.id);
    if (!driver) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    let order = await Order.findById(orderId);
    if (!order || order.driverId.toString() !== driver._id.toString() || order.status !== 'delivered') {
      return res.status(403).json({ message: 'Accès non autorisé ou commande non prête' });
    }

    order.status = 'delivery_issue';
    order.comments = reason || 'Problème signalé par le livreur';
    await order.save();

    await sendNotification(order.clientId, `Problème signalé pour la commande ${orderId}: ${reason || 'Non spécifié'}`);
    res.status(200).json({ message: 'Problème signalé', order });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du signalement', error: error.message });
  }
};