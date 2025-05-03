const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'Aucun token fourni' });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Aucun token fourni' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;

    // Vérifier les permissions si nécessaire
    // Par exemple, pour une route réservée aux admins
    // (Cette vérification est spécifique à certaines routes, nous la laissons ici mais elle pourrait être déplacée)
    if (req.user.role && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur' });
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Token invalide', error: error.message });
  }
};