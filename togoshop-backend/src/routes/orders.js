const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const Product = require('../models/Product');

// Routes de gestion des commandes
router.post('/', auth, ordersController.createOrder); // Créer une nouvelle commande
router.get('/supermarket/:supermarketId/pending', auth, ordersController.getPendingOrders); // Lister les commandes en attente
router.get('/user/cart', auth, ordersController.getUserCart); // Récupérer le panier
router.get('/user/me', auth, ordersController.getMyOrders); // Récupérer toutes les commandes de l'utilisateur
router.get('/user/history', auth, ordersController.getUserOrderHistory); // Récupérer l'historique des commandes
router.get('/:id', auth, ordersController.getOrderById); // Récupérer une commande spécifique
router.put('/:id', auth, ordersController.updateOrder); // Mettre à jour une commande
router.put('/:id/status', auth, ordersController.updateOrderStatus); // Mettre à jour le statut d'une commande

// Endpoint de débogage
router.get('/debug/product/:id', auth, async (req, res) => {
  try {
    console.log(`Requête GET /api/debug/product/:id avec id=${req.params.id}`);
    const product = await Product.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    res.status(200).json(product);
  } catch (error) {
    console.error('Erreur lors de la récupération du produit:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération du produit', error: error.message });
  }
});

module.exports = router;