const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const auth = require('../middleware/auth');
const mongoose = require('mongoose'); // Ajout pour utiliser ObjectId
const Product = require('../models/Product'); // Assure-toi d'importer le modèle Product

// Créer une nouvelle commande
router.post('/', auth, ordersController.createOrder);

// Lister les commandes en attente pour un supermarché
router.get('/supermarket/:supermarketId/pending', auth, ordersController.getPendingOrders);

// Mettre à jour le statut d'une commande
router.put('/:id/status', auth, ordersController.updateOrderStatus);

// Endpoint de debug pour récupérer un produit
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