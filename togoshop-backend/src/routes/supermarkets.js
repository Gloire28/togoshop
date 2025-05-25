const express = require('express');
const router = express.Router();
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
router.get('/', authMiddleware, supermarketsController.getAllSupermarkets); // Nouvelle route pour lister les supermarchés
router.get('/:id', supermarketsController.getSupermarket);
router.put('/:id', isAdmin, supermarketsController.updateSupermarket);

module.exports = router;