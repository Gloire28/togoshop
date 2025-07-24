const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userController = require('../controllers/usersController'); 

// Récupérer les informations de l'utilisateur connecté
router.get('/me', auth, userController.getUserProfile);

// Mettre à jour le profil de l'utilisateur
router.put('/me', auth, userController.updateUserProfile);

module.exports = router;