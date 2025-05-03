const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');
const auth = require('../middleware/auth'); // Changé de authMiddleware à auth

// Route pour ajouter un nouveau produit (nécessite authentification)
router.post('/', auth, productsController.createProduct);

// Route pour récupérer tous les produits d’un supermarché (publique)
router.get('/supermarket/:supermarketId', productsController.getProductsBySupermarket);

// Route pour récupérer un produit par ID (publique)
router.get('/:id', productsController.getProductById);

// Route pour mettre à jour un produit (nécessite authentification)
router.put('/:id', auth, productsController.updateProduct);

// Route pour supprimer un produit (nécessite authentification)
router.delete('/:id', auth, productsController.deleteProduct);

module.exports = router;