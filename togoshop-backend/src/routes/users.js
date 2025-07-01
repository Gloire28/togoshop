const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const bcrypt = require('bcrypt');

// Récupérer les informations de l'utilisateur connecté
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des informations de l\'utilisateur', error: error.message });
  }
});

// Inscription d'un nouvel utilisateur
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Vérification des champs requis
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    // Vérification si l'email ou le téléphone existe déjà
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé' });
    }

    // Hash du mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Création du nouvel utilisateur
    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
    });
    await user.save();

    res.status(201).json({ message: 'Inscription réussie', user: { id: user._id, name, email, phone } });
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error.message);
    res.status(500).json({ message: 'Erreur lors de l\'inscription', error: error.message });
  }
});

module.exports = router;