const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const auth = require('../middleware/auth'); // Importation correcte
const mongoose = require('mongoose');
const Product = require('../models/Product');

// Routes de gestion des commandes
router.post('/', auth, ordersController.createOrder); // Crée une nouvelle commande
router.get('/supermarket/:supermarketId/pending', auth, ordersController.getPendingOrders); // Récupère les commandes en attente d’un supermarché
router.get('/user/cart', auth, ordersController.getUserCart); // Récupère le panier de l’utilisateur
router.get('/user/me', auth, ordersController.getMyOrders); // Récupère les commandes de l’utilisateur
router.get('/user/history', auth, ordersController.getUserOrderHistory); // Récupère l’historique des commandes
router.get('/:id', auth, ordersController.getOrderById); // Récupère une commande par ID
router.put('/:id', auth, ordersController.updateOrder); // Met à jour une commande
router.put('/:id/status', auth, ordersController.updateOrderStatus); // Met à jour le statut d’une commande

// Route pour ajouter un commentaire à un produit dans une commande
router.post('/:id/upload-photo', auth, ordersController.uploadPhoto); // Télécharge une photo pour une commande

// Nouvelle route pour ajouter un produit au panier
router.post('/user/cart', auth, ordersController.addToCart);

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