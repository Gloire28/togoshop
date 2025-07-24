// userController.js
const User = require('../models/User');
const bcrypt = require('bcrypt');
const Loyalty = require('../models/loyalty'); // Corriger l'importation (majuscule)

// Récupérer le profil de l'utilisateur connecté
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    const userLoyalty = await Loyalty.findOne({ userId: req.user.id }).lean(); // Renommer la variable locale
    res.status(200).json({
      id: user._id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      referralCode: user.referralCode,
      referralCount: user.referralCount || 0,
      loyaltyPoints: userLoyalty ? userLoyalty.points : 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération du profil', error: error.message });
  }
};

// Mettre à jour le profil de l'utilisateur
exports.updateUserProfile = async (req, res) => {
  try {
    const { email, password, phone, name } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Mise à jour des champs
    if (name) user.name = name;
    if (email) {
      const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailExists) {
        return res.status(400).json({ message: 'Cet email est déjà utilisé' });
      }
      user.email = email;
    }
    if (phone) user.phone = phone;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    user.updatedAt = Date.now();
    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.status(200).json({ message: 'Profil mis à jour avec succès', user: updatedUser });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil', error: error.message });
  }
};