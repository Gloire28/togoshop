const express = require('express');
const router = express.Router();
const promotionsController = require('../controllers/promotionsController');
const auth = require('../middleware/auth');

// Créer une nouvelle promotion (admin ou manager)
router.post('/', auth, promotionsController.createPromotion);

// Lister toutes les promotions actives
router.get('/', auth, promotionsController.getActivePromotions);

// Lister les promotions par supermarché
router.get('/supermarket/:supermarketId', auth, promotionsController.getPromotionsBySupermarket);

// Appliquer une promotion à une commande (client ou admin)
router.post('/apply', auth, promotionsController.applyPromotion);

// Mettre à jour une promotion
router.put('/:id', auth, promotionsController.updatePromotion);

// Supprimer une promotion
router.delete('/:id', auth, promotionsController.deletePromotion);

module.exports = router;