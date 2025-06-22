const express = require('express');
const router = express.Router();
console.log('Routeur supermarkets chargé et prêt à traiter les requêtes');
const supermarketsController = require('../controllers/supermarketsController');
const authMiddleware = require('../middleware/auth');

// Middleware pour vérifier si l'utilisateur est un admin
const isAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Aucun token fourni' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Accès refusé : réservé aux administrateurs' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

// Routes
router.post('/', isAdmin, supermarketsController.createSupermarket);
router.get('/', authMiddleware, supermarketsController.getAllSupermarkets);
router.get('/:id', authMiddleware, supermarketsController.getSupermarket); 
router.put('/:id', isAdmin, supermarketsController.updateSupermarket);
router.patch('/:id/toggle-status', authMiddleware, supermarketsController.toggleSupermarketStatus);
router.get('/:id/status', authMiddleware, supermarketsController.getSupermarketStatus);

module.exports = router;