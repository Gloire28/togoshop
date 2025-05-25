const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Manager = require('../models/Manager');
const Driver = require('../models/Driver');
const Order = require('../models/Order');

module.exports = async (req, res, next) => {
  try {
    console.log('--- Début Middleware Auth ---');
    console.log('Requête reçue:', req.method, req.url);
    console.log('Chemin (req.path):', req.path);
    console.log('Base URL (req.baseUrl):', req.baseUrl);
    console.log('En-tête Authorization:', req.header('Authorization'));

    const authHeader = req.header('Authorization');
    if (!authHeader) {
      console.log('Erreur: Aucun en-tête Authorization trouvé');
      return res.status(401).json({ message: 'Aucun token fourni' });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      console.log('Erreur: Aucun token dans l\'en-tête Authorization');
      return res.status(401).json({ message: 'Aucun token fourni' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    console.log('Token décodé avec succès:', decoded);

    let user = null;
    let role = decoded.role;
    let roles = decoded.roles || [role];

    if (role === 'driver') {
      console.log('Recherche dans Driver pour id:', decoded.id);
      user = await Driver.findById(decoded.id);
    } else if (role === 'manager' || roles.includes('order_validator') || roles.includes('stock_manager')) {
      console.log('Recherche dans Manager pour id:', decoded.id);
      user = await Manager.findById(decoded.id);
    } else {
      console.log('Recherche dans User pour id:', decoded.id);
      user = await User.findById(decoded.id);
    }

    if (!user) {
      console.log(`Erreur: Utilisateur non trouvé pour id: ${decoded.id} (rôle: ${role})`);
      return res.status(401).json({ message: 'Utilisateur non trouvé dans la base', error: 'Vérifiez la base de données' });
    }
    console.log('Utilisateur récupéré:', user);

    req.user = {
      id: user._id.toString(),
      role: role,
      roles: roles,
      supermarketId: user.supermarketId ? user.supermarketId.toString() : undefined,
    };
    console.log('req.user défini:', req.user);

    // Ajout d'une vérification stricte pour s'assurer que req.user.id est bien défini
    if (!req.user.id) {
      console.log('Erreur: req.user.id non défini après construction');
      return res.status(500).json({ message: 'Erreur serveur: utilisateur mal configuré' });
    }

    const path = req.path;
    const method = req.method;
    console.log('Vérification des permissions:', { path, method, roles: req.user.roles, userId: req.user.id });

    // Autorisations spécifiques
    let isAuthorized = false;

    if (path === '/me') {
      console.log('Accès autorisé: Chemin /me');
      isAuthorized = true;
    } else if ((path === '/' || path === '/orders') && method === 'POST') {
      console.log('Accès autorisé: Chemin / ou /orders avec POST');
      isAuthorized = true;
    } else if (path === '/apply' && method === 'POST') {
      console.log('Accès autorisé: Chemin /apply avec POST');
      isAuthorized = true;
    } else if (path === '/promotions/apply' && method === 'POST') {
      console.log('Accès autorisé: Chemin /promotions/apply avec POST');
      isAuthorized = true;
    } else if (path.includes('/status') && method === 'PUT') {
      if (req.user.roles.includes('order_validator')) {
        console.log('Accès autorisé: Chemin contenant /status avec PUT et rôle order_validator');
        isAuthorized = true;
      } else if (req.user.role === 'driver' && req.body.status === 'delivered') {
        console.log('Accès autorisé: Chemin contenant /status avec PUT pour driver passant à delivered');
        isAuthorized = true;
      } else {
        console.log('Accès refusé: Rôle non autorisé pour /status avec PUT:', req.user.roles);
        return res.status(403).json({ message: 'Accès réservé aux validateurs ou livreurs (pour delivered)' });
      }
    } else if (path === '/redeem' && method === 'POST') {
      console.log('Accès autorisé: Chemin /redeem avec POST pour client');
      isAuthorized = true;
    } else if (path === '/user/me' && method === 'GET') {
      if (req.user.roles.includes('client')) {
        console.log('Accès autorisé: Chemin /user/me avec GET pour rôle client');
        isAuthorized = true;
      } else {
        console.log('Accès refusé: Rôle non client pour /user/me:', req.user.roles);
        return res.status(403).json({ message: 'Accès réservé aux clients' });
      }
    } else if (path.match(/^\/[0-9a-fA-F]{24}$/) && method === 'GET') {
      if (req.baseUrl === '/orders' && req.user.roles.includes('client')) {
        const orderId = path.substring(1);
        console.log(`Vérification de la commande ${orderId} pour le client ${req.user.id}`);
        const order = await Order.findById(orderId);
        if (!order) {
          console.log(`Commande ${orderId} non trouvée`);
          return res.status(404).json({ message: 'Commande non trouvée' });
        }
        if (order.clientId.toString() !== req.user.id) {
          console.log(`Utilisateur ${req.user.id} non autorisé à accéder à la commande ${orderId}`);
          return res.status(403).json({ message: 'Accès non autorisé' });
        }
        console.log(`Accès autorisé: Client ${req.user.id} peut accéder à la commande ${orderId}`);
        isAuthorized = true;
      } else if (req.baseUrl === '/products' && (
        req.user.roles.includes('client') ||
        req.user.roles.includes('admin') ||
        req.user.roles.includes('manager') ||
        req.user.role === 'driver'
      )) {
        console.log('Accès autorisé: Chemin /products/:id avec GET pour détails produit');
        isAuthorized = true;
      } else if (req.baseUrl === '/products') {
        console.log('Accès refusé: Rôle non autorisé pour /products/:id avec GET:', req.user.roles);
        return res.status(403).json({ message: 'Accès réservé aux utilisateurs authentifiés' });
      }
    } else if (path === '/user/cart' && method === 'POST' && req.user.roles.includes('client')) {
      console.log('Accès autorisé: Chemin /user/cart avec POST pour client');
      isAuthorized = true;
    } else if (path === '/' && method === 'GET') {
      if (req.user.roles.includes('client')) {
        console.log('Accès autorisé: Chemin / (pour /api/supermarkets) avec GET pour rôle client');
        isAuthorized = true;
      } else {
        console.log('Accès refusé: Rôle non client pour / (pour /api/supermarkets):', req.user.roles);
        return res.status(403).json({ message: 'Accès réservé aux clients' });
      }
    }

    // Vérification finale pour les routes non gérées
    if (!isAuthorized && req.user.roles && !req.user.roles.includes('admin') && !req.user.roles.includes('order_validator') && !req.user.roles.includes('client')) {
      console.log('Accès refusé: Rôles non admin ni order_validator pour chemin non géré:', req.user.roles);
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au validateur de commandes' });
    }

    console.log('req.user avant next:', req.user); // Log avant de passer à la route
    console.log('Accès autorisé: Admin ou autre cas');
    next();
  } catch (error) {
    console.log('Erreur dans auth.js:', error.message);
    return res.status(401).json({ message: 'Token invalide', error: error.message });
  } finally {
    console.log('--- Fin Middleware Auth ---');
  }
};