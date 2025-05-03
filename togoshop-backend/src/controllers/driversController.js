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
      password, // Le mot de passe sera haché automatiquement par le modèle
      phoneNumber,
      vehicleDetails,
      status: 'offline', // Statut par défaut
      earnings: 0,
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
      { expiresIn: '1d' } // Token valide pendant 1 jour
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