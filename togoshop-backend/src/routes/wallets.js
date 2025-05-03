const express = require('express');
const router = express.Router();
const walletsController = require('../controllers/walletsController');
const auth = require('../middleware/auth');

// Créditer le portefeuille (dépôt par le client ou via Flooz/TMoney)
router.post('/deposit', auth, walletsController.depositToWallet);

// Consulter le solde et l’historique du portefeuille (client)
router.get('/me', auth, walletsController.getWallet);

// Créditer un portefeuille pour une remise ou compensation (admin ou validateur)
router.post('/credit', auth, walletsController.creditWallet);

module.exports = router;