const express = require('express');
const router = express.Router();
const promotionsController = require('../controllers/promotionsController');
const auth = require('../middleware/auth');

// Créer une nouvelle promotion (admin)
router.post('/', auth, promotionsController.createPromotion);

// Lister toutes les promotions actives
router.get('/', auth, promotionsController.getActivePromotions);

// Appliquer une promotion à une commande (client)
router.post('/apply', auth, promotionsController.applyPromotion);

// Mettre à jour une promotion
router.put('/:id', auth, promotionsController.updatePromotion);

// Supprimer une promotion
router.delete('/:id', auth, promotionsController.deletePromotion);

module.exports = router;