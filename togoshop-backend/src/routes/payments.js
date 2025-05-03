const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');
const auth = require('../middleware/auth');

// Créer un nouveau paiement (client authentifié)
router.post('/', auth, paymentsController.createPayment);

// Récupérer un paiement par ID (client ou admin)
router.get('/:id', auth, paymentsController.getPayment); // Changé de getPaymentById à getPayment

module.exports = router;