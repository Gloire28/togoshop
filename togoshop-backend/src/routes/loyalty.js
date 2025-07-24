const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyaltyController');
const auth = require('../middleware/auth');

// Consulter les points de fidélité de l'utilisateur connecté
router.get('/me', auth, loyaltyController.getUserLoyalty);

// Ajouter des points (automatisé après une commande ou manuel par un admin)
router.post('/add', auth, loyaltyController.addPoints);

// Utiliser des points pour une réduction ou récompense
router.post('/redeem', auth, loyaltyController.redeemPoints);

//remboursement des point de fidélité
router.post('/refund', auth, loyaltyController.refundPoints);

module.exports = router;