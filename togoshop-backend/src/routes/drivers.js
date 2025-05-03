const express = require('express');
const router = express.Router();
const driversController = require('../controllers/driversController');
const auth = require('../middleware/auth');

// Inscription d'un nouveau livreur (réservé à l'administrateur)
router.post('/register', auth, driversController.registerDriver);

// Connexion d'un livreur
router.post('/login', driversController.loginDriver);

// Récupérer les informations du livreur connecté
router.get('/me', auth, driversController.getDriver);

// Mettre à jour la position du livreur
router.put('/location', auth, driversController.updateDriverLocation);

module.exports = router;