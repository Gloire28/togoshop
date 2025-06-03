const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Manager = require('../models/Manager');
const Driver = require('../models/Driver');
const Order = require('../models/Order');

// Tableau de permissions strictes (routes spécifiques en premier)
const permissions = [
  { path: '/login', method: 'POST', baseUrl: '/api/auth', roles: [] },
  { path: '/manager', method: 'GET', baseUrl: '/api/orders', roles: ['manager', 'order_validator', 'stock_manager'] },
  { path: '/supermarket/:supermarketId/pending', method: 'GET', baseUrl: '/api/orders', roles: ['manager', 'order_validator', 'stock_manager'] },
  { path: '/me', method: 'GET', baseUrl: '/api/managers', roles: ['manager', 'order_validator', 'stock_manager'] },
  { path: '/me/availability', method: 'PUT', baseUrl: '/api/managers', roles: ['manager', 'order_validator', 'stock_manager'] },
  { path: '/:id/submit', method: 'PUT', baseUrl: '/api/orders', roles: ['client'] },
  { path: '/:id/validate-delivery', method: 'POST', baseUrl: '/api/orders', roles: ['client'] },
  { path: '/:id', method: 'GET', baseUrl: '/api/orders', roles: ['client'], additionalCheck: async (req) => {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    if (!order) return false;
    return order.clientId.toString() === req.user.id;
  }},
  { path: '/:id', method: 'PUT', baseUrl: '/api/orders', roles: ['client'], additionalCheck: async (req) => {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    if (!order) return false;
    return order.clientId.toString() === req.user.id && ['cart_in_progress', 'pending_validation', 'awaiting_validator'].includes(order.status);
  }},
  { path: '/:id/status', method: 'PUT', baseUrl: '/api/orders', roles: ['manager', 'order_validator', 'stock_manager'], additionalCheck: async (req) => {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    if (!order) return false;
    const user = req.user;
    return order.supermarketId.toString() === user.supermarketId && 
           (order.assignedManager?.toString() === user.id || !order.assignedManager);
  }},
  { path: '/:id', method: 'GET', baseUrl: '/api/products', roles: ['client', 'driver', 'manager', 'admin'] },
  { path: '/:id', method: 'PUT', baseUrl: '/api/products', roles: ['admin', 'stock_manager'] },
  { path: '/', method: 'POST', baseUrl: '/api/products', roles: ['admin', 'stock_manager'] },
  { path: '/:id', method: 'DELETE', baseUrl: '/api/products', roles: ['admin', 'stock_manager'] },
  { path: '/', method: 'POST', baseUrl: '/api/orders', roles: ['client'] },
  { path: '/user/me', method: 'GET', baseUrl: '/api/orders', roles: ['client'] },
  { path: '/user/history', method: 'GET', baseUrl: '/api/orders', roles: ['client'] },
  { path: '/user/cart', method: 'GET', baseUrl: '/api/orders', roles: ['client'] },
  { path: '/user/cart', method: 'POST', baseUrl: '/api/orders', roles: ['client'] },
  { path: '/me', method: 'GET', baseUrl: '/api/drivers', roles: ['driver'] },
  { path: '/location', method: 'PUT', baseUrl: '/api/drivers', roles: ['driver'] },
  { path: '/discoverable', method: 'PUT', baseUrl: '/api/drivers', roles: ['driver'] },
  { path: '/:id/location', method: 'GET', baseUrl: '/api/drivers', roles: ['client'] },
  { path: '/orders/accept', method: 'POST', baseUrl: '/api/drivers', roles: ['driver'] },
  { path: '/orders/reject', method: 'POST', baseUrl: '/api/drivers', roles: ['driver'] },
  { path: '/orders/status', method: 'PUT', baseUrl: '/api/drivers', roles: ['driver'] },
  { path: '/driver/me', method: 'GET', baseUrl: '/api/orders', roles: ['driver'] },
  { path: '/register', method: 'POST', baseUrl: '/api/drivers', roles: ['admin'] },
  { path: '/', method: 'GET', baseUrl: '/api/supermarkets', roles: ['client'] },
  { path: '/points', method: 'GET', baseUrl: '/api/loyalty', roles: ['client'] },
  { path: '/me', method: 'GET', baseUrl: '/api/loyalty', roles: ['client'] },
  { path: '/me', method: 'GET', baseUrl: '/api/users', roles: ['client'] },
  { path: '/', method: 'GET', baseUrl: '/api/promotions', roles: ['client', 'driver', 'manager', 'admin'] },
];

// Fonction pour obtenir une description claire de l'action demandée
const getActionDescription = (method, baseUrl, path) => {
  if (baseUrl === '/api/managers') {
    if (path === 'me/availability' && method === 'PUT') return 'Mise à jour de la disponibilité du manager';
    if (path === 'me' && method === 'GET') return 'Récupération des informations du manager';
  }
  if (baseUrl === '/api/orders') {
    if (path === 'manager' && method === 'GET') return 'Récupération des commandes du manager';
    if (path === 'supermarket/:supermarketId/pending' && method === 'GET') return 'Récupération des commandes en attente du supermarché';
    if (path === ':id/submit' && method === 'PUT') return 'Soumission d\'une commande';
    if (path === ':id/validate-delivery' && method === 'POST') return 'Validation de la livraison d\'une commande';
    if (path === ':id' && method === 'GET') return 'Récupération des détails d\'une commande';
    if (path === ':id' && method === 'PUT') return 'Mise à jour d\'une commande';
    if (path === ':id/status' && method === 'PUT') return 'Mise à jour du statut d\'une commande';
    if (method === 'POST') return 'Création d\'une nouvelle commande';
    if (path === 'user/me' && method === 'GET') return 'Récupération des commandes de l\'utilisateur';
    if (path === 'user/history' && method === 'GET') return 'Récupération de l\'historique des commandes';
    if (path === 'user/cart' && method === 'GET') return 'Récupération du panier de l\'utilisateur';
    if (path === 'user/cart' && method === 'POST') return 'Ajout au panier de l\'utilisateur';
    if (path === 'driver/me' && method === 'GET') return 'Récupération des commandes du livreur';
  }
  if (baseUrl === '/api/products') {
    if (path === ':id' && method === 'GET') return 'Récupération des détails d\'un produit';
    if (path === ':id' && method === 'PUT') return 'Mise à jour d\'un produit';
    if (method === 'POST') return 'Création d\'un nouveau produit';
    if (path === ':id' && method === 'DELETE') return 'Suppression d\'un produit';
  }
  if (baseUrl === '/api/auth') {
    if (path === 'login' && method === 'POST') return 'Connexion de l\'utilisateur';
  }
  if (baseUrl === '/api/drivers') {
    if (path === 'me' && method === 'GET') return 'Récupération des informations du livreur';
    if (path === 'location' && method === 'PUT') return 'Mise à jour de la position du livreur';
    if (path === 'discoverable' && method === 'PUT') return 'Mise à jour de la visibilité du livreur';
    if (path === ':id/location' && method === 'GET') return 'Récupération de la position d\'un livreur';
    if (path === 'orders/accept' && method === 'POST') return 'Acceptation d\'une commande par le livreur';
    if (path === 'orders/reject' && method === 'POST') return 'Rejet d\'une commande par le livreur';
    if (path === 'orders/status' && method === 'PUT') return 'Mise à jour du statut d\'une commande par le livreur';
    if (path === 'register' && method === 'POST') return 'Inscription d\'un nouveau livreur';
  }
  if (baseUrl === '/api/supermarkets' && method === 'GET') return 'Récupération de la liste des supermarchés';
  if (baseUrl === '/api/loyalty') {
    if (path === 'points' && method === 'GET') return 'Récupération des points de fidélité';
    if (path === 'me' && method === 'GET') return 'Récupération des informations de fidélité';
  }
  if (baseUrl === '/api/promotions' && method === 'GET') return 'Récupération des promotions';
  if (baseUrl === '/api/users' && path === 'me' && method === 'GET') return 'Récupération des informations de l\'utilisateur';

  return 'Action inconnue';
};

// Fonction pour obtenir le nom de la section
const getSectionDescription = (baseUrl) => {
  if (baseUrl === '/api/managers') return 'Section des managers';
  if (baseUrl === '/api/orders') return 'Section des commandes';
  if (baseUrl === '/api/products') return 'Section des produits';
  if (baseUrl === '/api/auth') return 'Section de connexion';
  if (baseUrl === '/api/drivers') return 'Section des livreurs';
  if (baseUrl === '/api/supermarkets') return 'Section des supermarchés';
  if (baseUrl === '/api/loyalty') return 'Section de fidélité';
  if (baseUrl === '/api/promotions') return 'Section des promotions';
  if (baseUrl === '/api/users') return 'Section des utilisateurs';
  return 'Section inconnue';
};

module.exports = async (req, res, next) => {
  try {
    console.log('=== Une action a été demandée ===');
    
    // Normaliser req.baseUrl
    let baseUrl = req.baseUrl || '';
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    // Calculer le chemin relatif avec gestion explicite de l'ID
    let path = req.path;
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    const method = req.method;
    const action = getActionDescription(method, baseUrl, path);
    const section = getSectionDescription(baseUrl);
    
    console.log(`Action : ${action}`);
    console.log(`Où : ${section}`);
    console.log('Début de la vérification : Vérification si l\'utilisateur peut faire cette action...');

    const authHeader = req.header('Authorization');
    if (!authHeader) {
      console.log('Problème : Aucun identifiant n\'a été trouvé');
      return res.status(401).json({ message: 'Aucun token fourni' });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      console.log('Problème : Aucun identifiant n\'a été trouvé');
      return res.status(401).json({ message: 'Aucun token fourni' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    let user = null;
    const role = decoded.role;

    if (role === 'driver') {
      user = await Driver.findById(decoded.id);
    } else if (role === 'manager' || role === 'order_validator' || role === 'stock_manager') {
      user = await Manager.findById(decoded.id);
    } else if (role === 'client') {
      user = await User.findById(decoded.id);
    } else if (role === 'admin') {
      user = await User.findById(decoded.id);
    } else {
      console.log(`Problème : Le type d\'utilisateur "${role}" n\'est pas reconnu`);
      return res.status(403).json({ message: 'Rôle non reconnu' });
    }

    if (!user) {
      console.log(`Problème : Utilisateur non trouvé dans le système (identifiant: ${decoded.id})`);
      return res.status(401).json({ message: 'Utilisateur non trouvé dans la base' });
    }

    let supermarketId = user.supermarketId ? user.supermarketId.toString() : undefined;

    if (role === 'manager' || role === 'order_validator' || role === 'stock_manager') {
      if (!supermarketId) {
        console.log(`Problème : Aucun supermarché n\'est associé à cet utilisateur (identifiant: ${decoded.id})`);
        return res.status(403).json({ message: 'supermarketId requis pour ce rôle' });
      }
    }

    req.user = {
      id: user._id.toString(),
      role: role.trim(),
      supermarketId,
      locationId: user.locationId ? user.locationId.toString() : undefined,
      roles: Array.isArray(user.roles) ? user.roles.map(r => r.trim()) : [],
    };

    const rolesList = req.user.roles.length > 0 ? req.user.roles.join(' et ') : 'aucun rôle supplémentaire';
    console.log(`Utilisateur trouvé : C\'est un ${req.user.role} avec les rôles "${rolesList}"`);

    // Recherche de la permission correspondante avec gestion améliorée des paramètres
    const permission = permissions.find(p => {
      let normalizedPermissionPath = p.path;
      if (normalizedPermissionPath.startsWith('/')) {
        normalizedPermissionPath = normalizedPermissionPath.substring(1);
      }

      // Vérifier si le chemin contient un ID suivi de /status
      const pathParts = path.split('/');
      const isIdStatusRoute = pathParts.length === 2 && /^[0-9a-fA-F]{24}$/.test(pathParts[0]) && pathParts[1] === 'status';
      const isIdSubmitRoute = pathParts.length === 2 && /^[0-9a-fA-F]{24}$/.test(pathParts[0]) && pathParts[1] === 'submit';
      const isIdValidateDeliveryRoute = pathParts.length === 2 && /^[0-9a-fA-F]{24}$/.test(pathParts[0]) && pathParts[1] === 'validate-delivery';
      const isIdLocationRoute = pathParts.length === 2 && /^[0-9a-fA-F]{24}$/.test(pathParts[0]) && pathParts[1] === 'location';
      const isIdRoute = normalizedPermissionPath === ':id' && /^[0-9a-fA-F]{24}$/.test(path);
      
      // Vérifier si le chemin correspond exactement à la permission ou suit un pattern avec :id
      let pathMatch = normalizedPermissionPath === path || isIdRoute;
      if (normalizedPermissionPath === ':id/status') {
        pathMatch = isIdStatusRoute;
      } else if (normalizedPermissionPath === ':id/submit') {
        pathMatch = isIdSubmitRoute;
      } else if (normalizedPermissionPath === ':id/validate-delivery') {
        pathMatch = isIdValidateDeliveryRoute;
      } else if (normalizedPermissionPath === ':id/location') {
        pathMatch = isIdLocationRoute;
      }

      const baseUrlMatch = p.baseUrl === baseUrl || (p.baseUrl === baseUrl.replace(/\/$/, '') && baseUrl !== '');
      console.log(`Test permission - p.path: ${p.path}, normalizedPermissionPath: ${normalizedPermissionPath}, path: ${path}, isIdStatusRoute: ${isIdStatusRoute}, isIdRoute: ${isIdRoute}, pathMatch: ${pathMatch}, baseUrlMatch: ${baseUrlMatch}`);
      return pathMatch && p.method === method && baseUrlMatch;
    });

    if (!permission) {
      console.log(`Problème : Aucune règle ne permet cette action (${method} ${baseUrl}/${path})`);
      return res.status(403).json({ message: 'Accès non autorisé: route non définie' });
    }

    if (permission.roles.length > 0) {
      const userRoles = [req.user.role].concat(req.user.roles || []).map(role => role.trim());
      const permittedRoles = permission.roles.map(role => role.trim());
      const isAuthorized = permittedRoles.some(role => userRoles.includes(role));
      if (!isAuthorized) {
        console.log(`Problème : Cet utilisateur n\'a pas les droits nécessaires pour cette action (rôles requis : ${permittedRoles.join(', ')})`);
        return res.status(403).json({ message: `Accès réservé aux rôles: ${permittedRoles.join(', ')}` });
      }
    }

    if (permission.additionalCheck) {
      const isAllowed = await permission.additionalCheck(req);
      if (!isAllowed) {
        console.log(`Problème : Une vérification supplémentaire a échoué pour cette action`);
        return res.status(403).json({ message: 'Accès non autorisé: vérification échouée' });
      }
    }

    console.log(`Vérification réussie : L\'utilisateur a le droit de faire cette action`);
    console.log(`Action autorisée : ${action}`);
    next();
  } catch (error) {
    console.log(`Problème : L\'identifiant de l\'utilisateur est invalide`);
    return res.status(401).json({ message: 'Token invalide', error: error.message });
  } finally {
    console.log('Fin de la vérification');
  }
};