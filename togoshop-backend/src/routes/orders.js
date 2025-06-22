const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const Product = require('../models/Product');

// Middleware de débogage
router.use((req, res, next) => {
  console.log(`Route appelée: ${req.method} ${req.originalUrl}`);
  console.log(`Chemin: ${req.path}`);
  next();
});

// Routes statiques (chemins fixes)
router.get('/manager', auth, ordersController.getManagerOrders);
router.get('/driver/me', auth, ordersController.getDriverOrders);
router.get('/user/cart', auth, ordersController.getUserCart);
router.get('/user/me', auth, ordersController.getMyOrders);
router.get('/user/history', auth, ordersController.getUserOrderHistory);
router.post('/user/cart', auth, ordersController.addToCart);
router.post('/', auth, ordersController.createOrder);
router.get('/supermarket/:supermarketId/pending', auth, ordersController.getPendingOrders);

// Routes dynamiques spécifiques (/:id/quelque-chose)
router.post('/:id/validate-delivery-driver', auth, ordersController.validateDeliveryByDriver);
router.post('/:id/validate-delivery', auth, ordersController.validateDelivery);
router.post('/:id/upload-photo', auth, ordersController.uploadPhoto);
router.put('/:id/submit', auth, (req, res, next) => {
  console.log(`Route spécifique /:id/submit appelée avec id: ${req.params.id}`);
  next();
}, ordersController.submitOrder);
router.put('/:id/status', auth, ordersController.updateOrderStatus);

// Routes dynamiques génériques (/:id)
router.get('/:id', auth, ordersController.getOrderById);
router.put('/:id', auth, ordersController.updateOrder);

// Route de débogage
router.get('/debug/product/:id', auth, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
    if (!product) return res.status(404).json({ message: 'Produit non trouvé' });
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du produit', error: error.message });
  }
});

module.exports = router;