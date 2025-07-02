const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Manager = require('../models/Manager');
const Driver = require('../models/Driver');
const Order = require('../models/Order');
const Supermarket = require('../models/Supermarket');
const Promotion = require('../models/Promotion');

// Tableau de permissions strictes (routes spécifiques en premier)
const permissions = [
  { path: '/login', method: 'POST', baseUrl: '/api/auth', roles: [] },
  { path: '/manager', method: 'GET', baseUrl: '/api/orders', roles: ['manager', 'order_validator', 'stock_manager'] },
  { path: '/supermarket/:supermarketId/pending', method: 'GET', baseUrl: '/api/orders', roles: ['manager', 'order_validator', 'stock_manager'] },
  { path: '/me', method: 'GET', baseUrl: '/api/managers', roles: ['manager', 'order_validator', 'stock_manager'] },
  { path: '/me/availability', method: 'PUT', baseUrl: '/api/managers', roles: ['manager', 'order_validator', 'stock_manager'] },
  { path: '/:id/submit', method: 'PUT', baseUrl: '/api/orders', roles: ['client'] },
  { path: '/:id/validate-delivery', method: 'POST', baseUrl: '/api/orders', roles: ['client'] },
  { 
    path: '/:id/validate-delivery-driver', 
    method: 'POST', 
    baseUrl: '/api/orders', 
    roles: ['driver'],
    additionalCheck: async (req) => {
      const orderId = req.params.id;
      const order = await Order.findById(orderId);
      if (!order) return false;
      return order.driverId.toString() === req.user.id && order.status === 'in_delivery';
    }
  },
  { 
    path: '/:id/resend-validation-code', 
    method: 'POST', 
    baseUrl: '/api/orders', 
    roles: ['client'], 
    additionalCheck: async (req) => {
      const orderId = req.params.id;
      const order = await Order.findById(orderId);
      if (!order) return false;
      return order.clientId.toString() === req.user.id && order.status === 'delivered';
    }
  },
  { 
    path: '/:id', 
    method: 'GET', 
    baseUrl: '/api/orders', 
    roles: ['client'], 
    additionalCheck: async (req) => {
      const orderId = req.params.id;
      const order = await Order.findById(orderId);
      if (!order) return false;
      return order.clientId.toString() === req.user.id;
    }
  },
  { 
    path: '/:id', 
    method: 'PUT', 
    baseUrl: '/api/orders', 
    roles: ['client'], 
    additionalCheck: async (req) => {
      const orderId = req.params.id;
      const order = await Order.findById(orderId);
      if (!order) return false;
      return order.clientId.toString() === req.user.id && ['cart_in_progress', 'pending_validation', 'awaiting_validator'].includes(order.status);
    }
  },
  // Remplacez la permission existante pour /:id/status par :
{ 
  path: '/:id/status', 
  method: 'PUT', 
  baseUrl: '/api/orders', 
  roles: ['manager', 'order_validator', 'stock_manager'], 
  additionalCheck: async (req) => {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    if (!order) return false;
    const user = req.user;
    // Autoriser l'annulation si la commande est en pending_validation et appartient au supermarché
    if (req.body.status === 'cancelled' && order.status === 'pending_validation') {
      return order.supermarketId.toString() === user.supermarketId;
    }
    return order.supermarketId.toString() === user.supermarketId && 
           (order.assignedManager?.toString() === user.id || !order.assignedManager);
  }
},
  { path: '/:id', method: 'GET', baseUrl: '/api/products', roles: ['client', 'driver', 'manager', 'admin'] },
  { 
    path: '/supermarket/:supermarketId', 
    method: 'GET', 
    baseUrl: '/api/products', 
    roles: ['manager', 'order_validator', 'stock_manager'], 
    additionalCheck: async (req) => {
      const { supermarketId } = req.params;
      return req.user.supermarketId === supermarketId;
    }
  },
  { 
    path: '/:id', 
    method: 'DELETE', 
    baseUrl: '/api/orders', 
    roles: ['client'], 
    additionalCheck: async (req) => {
      const orderId = req.params.id;
      const order = await Order.findById(orderId);
      if (!order) return false;
      return order.clientId.toString() === req.user.id;
    }
  },
  { path: '/:id', method: 'PUT', baseUrl: '/api/products', roles: ['admin', 'stock_manager'] },
  { path: '/', method: 'POST', baseUrl: '/api/products', roles: ['admin', 'stock_manager'] },
  { path: '/:id', method: 'DELETE', baseUrl: '/api/products', roles: ['admin', 'stock_manager'] },
  { path: '/upload-image', method: 'POST', baseUrl: '/api/products', roles: ['admin', 'stock_manager'] },
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
  { path: '/orders/report-issue', method: 'POST', baseUrl: '/api/drivers', roles: ['driver'] },
  { path: '/driver/me', method: 'GET', baseUrl: '/api/orders', roles: ['driver'] },
  { path: '/register', method: 'POST', baseUrl: '/api/drivers', roles: ['admin'] },
  { path: '/', method: 'GET', baseUrl: '/api/supermarkets', roles: ['client'] },
  { path: '/points', method: 'GET', baseUrl: '/api/loyalty', roles: ['client'] },
  { path: '/me', method: 'GET', baseUrl: '/api/loyalty', roles: ['client'] },
  { path: '/me', method: 'GET', baseUrl: '/api/users', roles: ['client'] },
  { path: '/', method: 'GET', baseUrl: '/api/promotions', roles: ['client', 'driver', 'manager', 'admin'] },
  { 
    path: '/supermarket/:supermarketId', 
    method: 'GET', 
    baseUrl: '/api/promotions', 
    roles: ['manager', 'order_validator', 'stock_manager'], 
    additionalCheck: async (req) => {
      const { supermarketId } = req.params;
      return req.user.supermarketId === supermarketId;
    }
  },
  { 
    path: '/', 
    method: 'POST', 
    baseUrl: '/api/promotions', 
    roles: ['manager', 'order_validator', 'stock_manager'], 
    additionalCheck: async (req) => {
      const { supermarketId } = req.body;
      return req.user.supermarketId === supermarketId;
    }
  },
  { 
    path: '/:id/toggle-status', 
    method: 'PATCH', 
    baseUrl: '/api/supermarkets', 
    roles: ['manager', 'order_validator', 'stock_manager'], 
    additionalCheck: async (req) => {
      const { id } = req.params;
      const supermarket = await Supermarket.findById(id);
      if (!supermarket) return false;
      const manager = supermarket.managers.find(m => m.managerId === req.user.id);
      return !!manager && (!req.user.supermarketId || supermarket._id.toString() === req.user.supermarketId);
    }
  },
  { path: '/:id/status', method: 'GET', baseUrl: '/api/supermarkets', roles: ['client', 'manager', 'order_validator', 'stock_manager', 'admin'] },
  { path: '/:id', method: 'GET', baseUrl: '/api/supermarkets', roles: ['client'] },
  { 
    path: '/:id', 
    method: 'PUT', 
    baseUrl: '/api/promotions', 
    roles: ['manager', 'order_validator', 'stock_manager'], 
    additionalCheck: async (req) => {
      const { id } = req.params;
      const { supermarketId } = req.body;
      return req.user.supermarketId === supermarketId;
    }
  },
  { 
    path: '/:id', 
    method: 'DELETE', 
    baseUrl: '/api/promotions', 
    roles: ['manager', 'order_validator', 'stock_manager'], 
    additionalCheck: async (req) => {
      const { id } = req.params;
      const promotion = await Promotion.findById(id);
      if (!promotion) return false;
      return req.user.supermarketId === promotion.supermarketId.toString();
    }
  },

  // Notifications
  { 
    path: 'subscribe', 
    method: 'POST', 
    baseUrl: '/api/notifications', 
    roles: ['client'] 
  },
  { 
    path: '', 
    method: 'GET', 
    baseUrl: '/api/notifications', 
    roles: ['client'] 
  },
  { 
    path: ':id/read', 
    method: 'PATCH', 
    baseUrl: '/api/notifications', 
    roles: ['client'] 
  },
  { 
    path: ':id', 
    method: 'DELETE', 
    baseUrl: '/api/notifications', 
    roles: ['client'] 
  },

// Création de notifications (admin)
  { 
    path: '', 
    method: 'POST', 
    baseUrl: '/api/notifications', 
    roles: ['admin', 'manager'] 
  },
];

// Fonction pour obtenir une description claire de l'action demandée
const getActionDescription = (method, baseUrl, path) => {
  if (baseUrl === '/api/managers') {
    if (path === 'me/availability' && method === 'PUT') return 'Mise à jour de la disponibilité du manager';
    if (path === 'me' && method === 'GET') return 'Récupération des informations du manager';
  }
  if (baseUrl === '/api/orders') {
    if (path === 'manager' && method === 'GET') return 'Récupération des commandes du manager';
    if (path.match(/^supermarket\/[0-9a-fA-F]{24}\/pending$/) && method === 'GET') return 'Récupération des commandes en attente du supermarché';
    if (path.match(/^[0-9a-fA-F]{24}\/submit$/) && method === 'PUT') return 'Soumission d\'une commande';
    if (path.match(/^[0-9a-fA-F]{24}\/validate-delivery$/) && method === 'POST') return 'Validation de la livraison d\'une commande par le client';
    if (path.match(/^[0-9a-fA-F]{24}\/validate-delivery-driver$/) && method === 'POST') return 'Validation de la livraison d\'une commande par le livreur';
    if (path.match(/^[0-9a-fA-F]{24}\/resend-validation-code$/) && method === 'POST') return 'Renvoi du code de validation pour une commande';
    if (path.match(/^[0-9a-fA-F]{24}$/) && method === 'GET') return 'Récupération des détails d\'une commande';
    if (path.match(/^[0-9a-fA-F]{24}$/) && method === 'PUT') return 'Mise à jour d\'une commande';
    if (path.match(/^[0-9a-fA-F]{24}\/status$/) && method === 'PUT') return 'Mise à jour du statut d\'une commande';
    if (method === 'POST' && path === '') return 'Création d\'une nouvelle commande';
    if (path === 'user/me' && method === 'GET') return 'Récupération des commandes de l\'utilisateur';
    if (path === 'user/history' && method === 'GET') return 'Récupération de l\'historique des commandes';
    if (path === 'user/cart' && method === 'GET') return 'Récupération du panier de l\'utilisateur';
    if (path === 'user/cart' && method === 'POST') return 'Ajout au panier de l\'utilisateur';
    if (path === 'driver/me' && method === 'GET') return 'Récupération des commandes du livreur';
  }
  if (baseUrl === '/api/products') {
    if (path.match(/^[0-9a-fA-F]{24}$/) && method === 'GET') return 'Récupération des détails d\'un produit';
    if (path.match(/^supermarket\/[0-9a-fA-F]{24}$/) && method === 'GET') return 'Récupération des produits d\'un supermarché';
    if (path.match(/^[0-9a-fA-F]{24}$/) && method === 'PUT') return 'Mise à jour d\'un produit';
    if (method === 'POST') return 'Création d\'un nouveau produit';
    if (path.match(/^[0-9a-fA-F]{24}$/) && method === 'DELETE') return 'Suppression d\'un produit';
  }
  if (baseUrl === '/api/auth') {
    if (path === 'login' && method === 'POST') return 'Connexion de l\'utilisateur';
  }
  if (baseUrl === '/api/drivers') {
    if (path === 'me' && method === 'GET') return 'Récupération des informations du livreur';
    if (path === 'location' && method === 'PUT') return 'Mise à jour de la position du livreur';
    if (path === 'discoverable' && method === 'PUT') return 'Mise à jour de la visibilité du livreur';
    if (path.match(/^[0-9a-fA-F]{24}\/location$/) && method === 'GET') return 'Récupération de la position d\'un livreur';
    if (path === 'orders/accept' && method === 'POST') return 'Acceptation d\'une commande par le livreur';
    if (path === 'orders/reject' && method === 'POST') return 'Rejet d\'une commande par le livreur';
    if (path === 'orders/status' && method === 'PUT') return 'Mise à jour du statut d\'une commande par le livreur';
    if (path === 'orders/report-issue' && method === 'POST') return 'Signalement d\'un problème de livraison par le livreur';
    if (path === 'register' && method === 'POST') return 'Inscription d\'un nouveau livreur';
  }
  if (baseUrl === '/api/supermarkets' && method === 'GET' && path === '') return 'Récupération de la liste des supermarchés';
  if (baseUrl === '/api/loyalty') {
    if (path === 'points' && method === 'GET') return 'Récupération des points de fidélité';
    if (path === 'me' && method === 'GET') return 'Récupération des informations de fidélité';
  }
  if (baseUrl === '/api/promotions') {
    if (path === '' && method === 'GET') return 'Récupération des promotions';
    if (path.match(/^supermarket\/[0-9a-fA-F]{24}$/) && method === 'GET') return 'Récupération des promotions d\'un supermarché';
    if (path === '' && method === 'POST') return 'Création d\'une nouvelle promotion';
  }
  if (baseUrl === '/api/users' && path === 'me' && method === 'GET') return 'Récupération des informations de l\'utilisateur';
  if (baseUrl === '/api/supermarkets') {
    if (path.match(/^[0-9a-fA-F]{24}\/toggle-status$/) && method === 'PATCH') return 'Basculement de l\'état du supermarché';
    if (path.match(/^[0-9a-fA-F]{24}\/status$/) && method === 'GET') return 'Récupération de l\'état du supermarché';
    if (path.match(/^[0-9a-fA-F]{24}$/) && method === 'GET') return 'Récupération des détails d\'un supermarché';
  }
  if (baseUrl === '/api/notifications') {
  if (path === 'subscribe' && method === 'POST') return 'Abonnement à une notification';
  if (path === '' && method === 'GET') return 'Récupération des notifications';
  if (path.match(/^[0-9a-fA-F]{24}\/read$/) && method === 'PATCH') return 'Marquer une notification comme lue';
  if (path.match(/^[0-9a-fA-F]{24}$/) && method === 'DELETE') return 'Suppression d\'une notification';
  if (method === 'POST' && path === '') return 'Création d\'une notification (admin)';
  }
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
  if (baseUrl === '/api/notifications') return 'Section des notifications';
  return 'Section inconnue';
};

module.exports = async (req, res, next) => {
  console.log('authMiddleware appelé pour:', req.originalUrl, 'avec baseUrl:', req.baseUrl, 'et chemin normalisé:', req.path.substring(1));
  try {
    console.log('Entrée dans le try de authMiddleware');
    // Normaliser req.baseUrl
    let baseUrl = req.baseUrl || '';
    if (!baseUrl && req.originalUrl.includes('/api/supermarkets')) {
      baseUrl = '/api/supermarkets';
    }
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    console.log(`Base URL détectée: ${baseUrl}`);
    
    // Calculer le chemin relatif
    let path = req.path;
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    console.log(`Chemin détecté: ${path}`);

    const method = req.method;
    const section = getSectionDescription(baseUrl);
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
    console.log('Token décodé', decoded);
    
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

    // Recherche de la permission correspondante avec gestion des paramètres dynamiques
    const permission = permissions.find(p => {
      let normalizedPermissionPath = p.path;
      if (normalizedPermissionPath.startsWith('/')) {
        normalizedPermissionPath = normalizedPermissionPath.substring(1);
      }

      // Décomposer les chemins en segments
      const permissionSegments = normalizedPermissionPath.split('/');
      const requestSegments = path.split('/');

      // Vérifier si les segments correspondent (en tenant compte des paramètres dynamiques comme :id)
      let pathMatch = false;
      if (permissionSegments.length === requestSegments.length) {
        pathMatch = permissionSegments.every((segment, index) => {
          if (segment.startsWith(':')) {
            // Segment dynamique (ex. :id) : vérifier que le segment de la requête est valide (ex. ObjectId pour :id)
            if (segment === ':id' || segment === ':supermarketId') {
              return /^[0-9a-fA-F]{24}$/.test(requestSegments[index]);
            }
            return true;
          }
          return segment === requestSegments[index];
        });
      }

      const baseUrlMatch = p.baseUrl === baseUrl || (baseUrl === '' && p.baseUrl === '/api') || p.baseUrl === '/api' + baseUrl;
      console.log(`Test permission - p.path: ${p.path}, normalizedPermissionPath: ${normalizedPermissionPath}, path: ${path}, pathMatch: ${pathMatch}, baseUrlMatch: ${baseUrlMatch}`);
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

    const action = getActionDescription(method, baseUrl, path);
    console.log(`Action : ${action}`);
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