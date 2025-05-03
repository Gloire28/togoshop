const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const auth = require('../middleware/auth');

// Suivre une commande en temps réel (client)
router.get('/order/:orderId', auth, trackingController.trackOrder);

module.exports = router;