const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Manager = require('../models/Manager');
const Driver = require('../models/Driver');

// Inscription
exports.register = async (req, res) => {
  try {
    const { email, password, role, name, supermarketId, locationId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    let Model;
    let userData = { email, password };

    if (role === 'manager') {
      Model = Manager;
      if (!name || !supermarketId || !locationId) {
        return res.status(400).json({ message: 'name, supermarketId et locationId sont requis pour un manager' });
      }
      userData = { ...userData, name, supermarketId, locationId, roles: ['order_validator', 'stock_manager'] };
    } else if (role === 'driver') {
      Model = Driver;
      if (!name || !phoneNumber) {
        return res.status(400).json({ message: 'name et phoneNumber sont requis pour un driver' });
      }
      userData = { ...userData, name, phoneNumber };
    } else {
      Model = User;
      userData.role = role || 'client';
    }

    console.log('Recherche d’un utilisateur existant avec email:', email);
    const existingUser = await Model.findOne({ email });
    if (existingUser) {
      console.log('Utilisateur existant trouvé:', existingUser);
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    console.log('Aucun utilisateur existant trouvé, création...');
    const hashedPassword = await bcrypt.hash(password, 10);
    userData.password = hashedPassword;

    const user = new Model(userData);
    await user.save();

    console.log('Utilisateur créé:', user);
    res.status(201).json({ message: 'Utilisateur créé avec succès', user });
  } catch (error) {
    console.error('Erreur lors de l’inscription:', error.message);
    res.status(500).json({ message: 'Erreur lors de l’inscription', error: error.message });
  }
};

// Connexion
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    console.log('Requête reçue: POST /api/auth/login');
    console.log('Recherche de l’utilisateur avec email:', email);

    // Recherche dans User (clients/admins)
    let user = await User.findOne({ email });
    let role = user ? user.role : null;
    let Model = User;

    if (!user) {
      console.log('Utilisateur non trouvé dans User, recherche dans Manager...');
      user = await Manager.findOne({ email });
      role = 'manager';
      Model = Manager;
    }

    if (!user) {
      console.log('Utilisateur non trouvé dans Manager, recherche dans Driver...');
      user = await Driver.findOne({ email });
      role = 'driver';
      Model = Driver;
    }

    if (!user) {
      console.log('Utilisateur non trouvé pour email:', email);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    console.log('Utilisateur trouvé:', user);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Mot de passe incorrect pour email:', email);
      return res.status(401).json({ message: 'Mot de passe incorrect' });
    }

    // Générer un token JWT avec une structure unifiée
    const tokenPayload = {
      id: user._id,
      role: role || (Model === Manager ? user.roles[0] : 'client'),
      roles: Model === Manager ? user.roles : [role || 'client']
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your_jwt_secret', // Remplacez par votre clé secrète
      { expiresIn: '1h' }
    );

    console.log('Token généré:', token);
    res.status(200).json({ token });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error.message);
    res.status(500).json({ message: 'Erreur lors de la connexion', error: error.message });
  }
};