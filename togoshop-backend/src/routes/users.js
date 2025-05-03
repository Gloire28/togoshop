const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Récupérer les informations de l'utilisateur connecté
router.get('/me', auth, async (req, res) => {
  try {
    // req.user est défini par le middleware auth
    const user = await User.findById(req.user.id).select('-password'); // Exclure le mot de passe
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des informations de l\'utilisateur', error: error.message });
  }
});

module.exports = router;