const express = require('express');
const router = express.Router();
const managersController = require('../controllers/managersController');
const auth = require('../middleware/auth');

// Inscription d'un manager (admin uniquement)
router.post('/', auth, managersController.registerManager);

// Récupérer les informations du manager connecté
router.get('/me', auth, managersController.getManager);

// Mettre à jour l'état de disponibilité du manager
router.put('/me/availability', auth, managersController.updateAvailability);

module.exports = router;