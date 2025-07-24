// authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Manager = require('../models/Manager');
const Driver = require('../models/Driver');
const Loyalty = require('../models/loyalty'); 
const { sendNotification } = require('../services/notifications');

// Inscription
exports.register = async (req, res) => {
  try {
    const { email, password, role, name, supermarketId, locationId, phone, referralCode } = req.body;

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
      userData = { ...userData, name, phoneNumber: phone };
    } else {
      Model = User;
      userData = { ...userData, name, phone, role: role || 'client', referralCode };
    }

    console.log('Recherche d’un utilisateur existant avec email:', email);
    const existingUser = await Model.findOne({ email });
    if (existingUser) {
      console.log('Utilisateur existant trouvé:', existingUser);
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Vérifier le code de parrainage (uniquement pour les utilisateurs de type User)
    let referredBy = null;
    if (Model === User && referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (!referrer) {
        return res.status(400).json({ message: 'Code de parrainage invalide' });
      }
      referredBy = referrer._id;
      userData.referredBy = referredBy;
      await User.findByIdAndUpdate(referredBy, { $inc: { referralCount: 1 } });
    }

    console.log('Aucun utilisateur existant trouvé, création...');
    const hashedPassword = await bcrypt.hash(password, 10);
    userData.password = hashedPassword;

    const user = new Model(userData);
    await user.save();

    // Créer un document Loyalty pour le nouvel utilisateur (uniquement pour User)
    if (Model === User) {
      let userLoyalty = await Loyalty.findOne({ userId: user._id });
      if (!userLoyalty) {
        userLoyalty = new Loyalty({ userId: user._id, points: 0, transactions: [] });
        await userLoyalty.save();
      }

      // Attribuer des points de fidélité si un code de parrainage est utilisé
      if (referredBy) {
        // 10 points pour le nouvel utilisateur
        userLoyalty.points += 10;
        userLoyalty.transactions.push({
          type: 'earned',
          amount: 10,
          description: 'Parrainage d’un nouvel utilisateur',
          date: new Date(),
        });
        await userLoyalty.save();
        await sendNotification(user._id, 'Vous avez gagné 10 points de fidélité pour votre inscription avec parrainage !');

        // 2 points pour le parrain
        let referrerLoyalty = await Loyalty.findOne({ userId: referredBy });
        if (!referrerLoyalty) {
          referrerLoyalty = new Loyalty({ userId: referredBy, points: 0, transactions: [] });
        }
        referrerLoyalty.points += 2;
        referrerLoyalty.transactions.push({
          type: 'earned',
          amount: 2,
          description: 'Nouveau filleul inscrit',
          date: new Date(),
        });
        await referrerLoyalty.save();
        await sendNotification(referredBy, 'Vous avez gagné 2 points de fidélité pour un nouveau filleul !');
      } else {
        // 10 points pour l'inscription sans parrainage
        userLoyalty.points += 10;
        userLoyalty.transactions.push({
          type: 'earned',
          amount: 10,
          description: 'Bonus d’inscription',
          date: new Date(),
        });
        await userLoyalty.save();
        await sendNotification(user._id, 'Vous avez gagné 10 points de fidélité pour votre inscription !');
      }
    }

    console.log('Utilisateur créé:', user);
    const newUser = user.toObject();
    delete newUser.password;

    res.status(201).json({ message: 'Utilisateur créé avec succès', user: newUser });
  } catch (error) {
    console.error('Erreur lors de l’inscription:', error.message);
    res.status(500).json({ message: 'Erreur lors de l’inscription', error: error.message });
  }
};

// Connexion (inchangée, mais incluse pour référence)
exports.login = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const phone = req.body.phone?.toString().trim();

    if (!name || !phone) {
      return res.status(400).json({ message: 'Nom et numéro de téléphone requis' });
    }

    console.log('Recherche normalisée - name:', `"${name}"`, 'phone:', `"${phone}"`);

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

    const tokenPayload = {
      id: user._id,
      role: role || (Model === Manager ? user.roles[0] : 'client'),
      roles: Model === Manager ? user.roles : [role || 'client']
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '5h' }
    );

    console.log('Token généré:', token);

    const userResponse = {
      id: user._id,
      name: user.name,
      role: role || (Model === Manager ? user.roles[0] : 'client'),
      ...(Model === User && { referralCode: user.referralCode }),
      ...(Model === Manager && { supermarketId: user.supermarketId, locationId: user.locationId }),
      ...(Model === Driver && { phoneNumber: user.phoneNumber }),
    };

    if (Model === User) {
      const userLoyalty = await Loyalty.findOne({ userId: user._id }).lean();
      userResponse.loyaltyPoints = userLoyalty ? userLoyalty.points : 0;
    }

    res.status(200).json({ token, user: userResponse });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error.message);
    res.status(500).json({ message: 'Erreur lors de la connexion', error: error.message });
  }
};