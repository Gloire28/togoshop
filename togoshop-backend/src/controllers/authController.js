const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Manager = require('../models/Manager');
const Driver = require('../models/Driver');

// Inscription
exports.register = async (req, res) => {
  try {
    const { email, password, role, name, supermarketId, locationId, phoneNumber } = req.body;

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
    const name = req.body.name?.trim();
    const phone = req.body.phone?.toString().trim();

    if (!name || !phone) {
      return res.status(400).json({ message: 'Nom et numéro de téléphone requis' });
    }

    console.log('Recherche normalisée - name:', `"${name}"`, 'phone:', `"${phone}"`);

    // Recherche dans User (clients/admins)
    let user = await User.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      phone
    });

    let role = user ? user.role : null;
    let Model = User;

    if (!user) {
      console.log('Utilisateur non trouvé dans User, recherche dans Manager...');
      user = await Manager.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        phone: parseInt(phone)
      });
      role = 'manager';
      Model = Manager;
    }

    if (!user) {
      console.log('Utilisateur non trouvé dans Manager, recherche dans Driver...');
      user = await Driver.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        phoneNumber: parseInt(phone)
      });
      role = 'driver';
      Model = Driver;
    }

    if (!user) {
      console.log('Utilisateur non trouvé pour name:', name, 'et phone:', phone);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    console.log('Utilisateur trouvé:', user);
    // Pas de vérification de mot de passe ici, car on utilise name + phone comme clé

    // Générer un token JWT avec une structure unifiée
    const tokenPayload = {
      id: user._id,
      role: role || (Model === Manager ? user.roles[0] : 'client'),
      roles: Model === Manager ? user.roles : [role || 'client']
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your_jwt_secret', // Remplacez par votre clé secrète
      { expiresIn: '5h' }
    );

    console.log('Token généré:', token);

    // Construire l'objet user à renvoyer
    const userResponse = {
      id: user._id,
      name: user.name,
      role: role || (Model === Manager ? user.roles[0] : 'client'),
      // Ajouter d'autres champs pertinents selon le modèle
      ...(Model === Manager && { supermarketId: user.supermarketId, locationId: user.locationId }),
      ...(Model === Driver && { phoneNumber: user.phoneNumber }),
    };

    res.status(200).json({ token, user: userResponse });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error.message);
    res.status(500).json({ message: 'Erreur lors de la connexion', error: error.message });
  }
};