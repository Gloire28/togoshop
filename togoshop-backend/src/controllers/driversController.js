const Driver = require('../models/Driver');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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
    await order.save();

    driver.status = 'busy';
    await driver.save();

    res.status(200).json({ message: 'Commande acceptée', order });
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
      // Pas de nouvelles commandes possibles
    } else if (status === 'delivered') {
      order.clientValidation = false; // Attendre la validation client
      await sendNotification(order.clientId, `Votre commande (${orderId}) a été livrée. Veuillez valider.`);
    }
    await order.save();

    res.status(200).json({ message: 'Statut mis à jour', order });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut', error: error.message });
  }
};