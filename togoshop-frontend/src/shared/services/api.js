import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.1.64:5000/api';

export const apiRequest = async (endpoint, options = {}) => {
  const { method = 'GET', body = null, isFormData = false } = options;

  try {
    const token = await AsyncStorage.getItem('token');
    console.log('Token envoyé dans la requête:', token);
    console.log('Requête envoyée:', `${BASE_URL}${endpoint}`, { method, headers: { 'Content-Type': isFormData ? 'multipart/form-data' : 'application/json', ...(token && { Authorization: `Bearer ${token}` }) } });

    if (!token && !isFormData && endpoint !== '/auth/login' && endpoint !== '/drivers/login') {
      throw new Error('Aucun token trouvé dans AsyncStorage');
    }

    const headers = { 'Content-Type': isFormData ? 'multipart/form-data' : 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? (isFormData ? body : JSON.stringify(body)) : null,
    });

    const text = await response.text();
    console.log('Réponse brute de l\'API:', text);
    if (!response.ok) {
      if (response.status === 405) {
        throw new Error(`Méthode non autorisée : ${method} sur ${endpoint}`);
      }
      if (text.includes('jwt expired')) {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        throw new Error('jwt expired');
      }
      throw new Error(`Erreur serveur : ${response.status} - ${text || 'Aucune réponse'}`);
    }

    const data = text ? JSON.parse(text) : {};
    console.log('Données parsées de l\'API:', data);
    return data;
  } catch (error) {
    throw error;
  }
};

// Récupérer un supermarché par ID
export const getSupermarket = (supermarketId) => {
  if (!supermarketId) throw new Error('supermarketId manquant pour getSupermarket');
  return apiRequest(`/supermarkets/${supermarketId}`, { method: 'GET' });
};

// Récupérer la liste des supermarchés
export const getSupermarkets = () => apiRequest('/supermarkets', { method: 'GET' });

// Récupérer les produits d’un supermarché pour une localisation donnée
export const getProducts = async (supermarketId, locationId) => {
  if (!supermarketId || !locationId) throw new Error('Paramètres manquants');
  try {
    const productsData = await apiRequest(`/products/supermarket/${supermarketId}?locationId=${locationId}`, { method: 'GET' });
    const products = productsData.data || productsData; // Adapter selon la structure de la réponse API

    // Pas d'enrichissement artificiel, juste retour des données brutes
    const enrichedProducts = products.map(product => product); // Identité pour l'instant

    console.log('Produits récupérés avec promotedPrice:', enrichedProducts);
    return enrichedProducts; // Retourner directement le tableau
  } catch (error) {
    throw error;
  }
};

// Récupérer les promotions actives
export const getPromotions = () => apiRequest('/promotions', { method: 'GET' });

// Créer une nouvelle commande
export const createOrder = (orderData) => apiRequest('/orders', { method: 'POST', body: orderData });

// Récupérer le panier de l’utilisateur
export const getUserCart = () => apiRequest('/orders/user/cart', { method: 'GET' });

// Mettre à jour une commande existante
export const updateOrder = (orderId, orderData) => {
  if (!orderId) throw new Error('orderId manquant pour updateOrder');
  return apiRequest(`/orders/${orderId}`, { method: 'PUT', body: orderData });
};

// Mettre à jour le statut d'une commande (côté client/manager)
export const updateOrderStatus = (orderId, status) => {
  if (!orderId || !status) throw new Error('orderId ou status manquant pour updateOrderStatus');
  return apiRequest(`/orders/${orderId}/status`, { method: 'PUT', body: { status } });
};

// Télécharger une photo pour une commande
export const uploadPhoto = (orderId, formData) => apiRequest(`/orders/${orderId}/upload-photo`, { method: 'POST', body: formData, isFormData: true });

// Connexion utilisateur
export const login = (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials });

// Ajouter un produit au panier
export const addToCartAPI = (cartItem) => {
  if (!cartItem.supermarketId || !cartItem.locationId) {
    throw new Error('supermarketId et locationId sont requis pour ajouter un produit au panier');
  }
  const body = { products: [cartItem] };
  return apiRequest('/orders/user/cart', { method: 'POST', body });
};

// Appliquer un code promo à une commande
export const applyPromotion = (promoCode, orderId) => apiRequest('/promotions/apply', { method: 'POST', body: { code: promoCode, orderId } });

// Récupérer les points de fidélité de l’utilisateur
export const getUserLoyalty = () => apiRequest('/loyalty/me', { method: 'GET' });

// Utiliser des points de fidélité pour une réduction
export const redeemPoints = (points, orderId) => apiRequest('/loyalty/redeem', { method: 'POST', body: { points, orderId } });

// Récupérer toutes les commandes de l’utilisateur
export const getUserOrders = () => apiRequest('/orders/user/me', { method: 'GET' });

// Récupérer les informations du manager
export const getManagerInfo = () => apiRequest('/managers/me', { method: 'GET' });

// Récupérer les commandes du manager
export const getManagerOrders = () => apiRequest('/orders/manager', { method: 'GET' });

// Connexion d’un livreur
export const loginDriver = (credentials) => apiRequest('/drivers/login', { method: 'POST', body: credentials });

// Récupérer les informations du livreur connecté
export const getDriverInfo = () => apiRequest('/drivers/me', { method: 'GET' });

// Mettre à jour la position du livreur
export const updateDriverLocation = (lat, lng) => apiRequest('/drivers/location', { method: 'PUT', body: { lat, lng } });

// Récupérer les commandes assignées au livreur, incluant les statuts pertinents
export const getDriverOrders = () => apiRequest('/orders/driver/me?statuses=validated,ready_for_pickup,in_delivery,delivered', { method: 'GET' });

// Activer/Désactiver la détectabilité du livreur
export const toggleDriverDiscoverable = () => apiRequest('/drivers/discoverable', { method: 'PUT' });

// Accepter une commande
export const acceptOrder = (orderId) => {
  if (!orderId) throw new Error('orderId manquant pour acceptOrder');
  return apiRequest('/drivers/orders/accept', { method: 'POST', body: { orderId } });
};

// Rejeter une commande
export const rejectOrder = (orderId) => {
  if (!orderId) throw new Error('orderId manquant pour rejectOrder');
  return apiRequest('/drivers/orders/reject', { method: 'POST', body: { orderId } });
};

// Mettre à jour le statut d'une commande (côté livreur)
export const updateDriverOrderStatus = (orderId, status) => {
  if (!orderId || !status) throw new Error('orderId ou status manquant pour updateDriverOrderStatus');
  return apiRequest('/drivers/orders/status', { method: 'PUT', body: { orderId, status } });
};

export const reportDeliveryIssue = (orderId, issueDetails) => {
  if (!orderId || !issueDetails) throw new Error('orderId ou issueDetails manquant pour reportDeliveryIssue');
  return apiRequest('/drivers/orders/report-issue', { method: 'POST', body: { orderId, issueDetails } });
};
// Valider une livraison par chauffeur

export const validateDeliveryByDriver = (orderId, validationCode) => {
  if (!orderId || !validationCode) throw new Error('orderId ou validationCode manquant pour validateDeliveryByDriver');
  return apiRequest(`/orders/${orderId}/validate-delivery-driver`, { method: 'POST', body: { validationCode } });
};
// Valider une livraison (côté client)
export const validateDelivery = (orderId) => {
  if (!orderId) throw new Error('orderId manquant pour validateDelivery');
  return apiRequest(`/orders/${orderId}/validate-delivery`, { method: 'POST', body: { orderId } });
};

// Renvoie un code de validation pour le client (en cas de problème avec la validation de la commande)
export const resendValidationCode = (orderId) => {
  if (!orderId) throw new Error('orderId manquant pour resendValidationCode');
  return apiRequest(`/orders/${orderId}/resend-validation-code`, { method: 'POST', body: { orderId } });
};

// Récupérer les détails d’une commande (pour le suivi client)
export const getOrderDetails = (orderId) => {
  if (!orderId) throw new Error('orderId manquant pour getOrderDetails');
  return apiRequest(`/orders/${orderId}`, { method: 'GET' });
};

// Récupérer la position d’un livreur (pour le suivi client)
export const getDriverLocation = (driverId) => {
  if (!driverId) throw new Error('driverId manquant pour getDriverLocation');
  return apiRequest(`/drivers/${driverId}/location`, { method: 'GET' });
};

// Récupérer les informations du profil utilisateur
export const getUserProfile = () => {
  console.log('Appel de getUserProfile avec endpoint: /users/me');
  const response = apiRequest('/users/me', { method: 'GET' });
  console.log('Réponse de getUserProfile:', response);
  return response;
};

// Basculement de l'état du supermarché (pour le manager)
export const toggleSupermarketStatus = (supermarketId, statusData) => {
  if (!supermarketId) throw new Error('supermarketId manquant pour toggleSupermarketStatus');
  return apiRequest(`/supermarkets/${supermarketId}/toggle-status`, { method: 'PATCH', body: statusData });
};

// Récupérer l'état du supermarché
export const getSupermarketStatus = (supermarketId) => {
  if (!supermarketId) throw new Error('supermarketId manquant pour getSupermarketStatus');
  return apiRequest(`/supermarkets/${supermarketId}/status`, { method: 'GET' });
};

// Récupérer tous les produits d’un supermarché
export const getSupermarketProducts = (supermarketId) => {
  if (!supermarketId) throw new Error('supermarketId manquant pour getSupermarketProducts');
  return apiRequest(`/products/supermarket/${supermarketId}`, { method: 'GET' });
};

// Créer une nouvelle promotion
export const createPromotion = (promotionData) => {
  if (!promotionData) throw new Error('promotionData manquant pour createPromotion');
  return apiRequest('/promotions', { method: 'POST', body: promotionData });
};

// Récupérer les promotions d’un supermarché
export const getSupermarketPromotions = (supermarketId) => {
  if (!supermarketId) throw new Error('supermarketId manquant pour getSupermarketPromotions');
  return apiRequest(`/promotions/supermarket/${supermarketId}`, { method: 'GET' });
};

// Modifier une promotion
export const updatePromotion = (promotionId, promotionData) => {
  if (!promotionId) throw new Error('promotionId manquant pour updatePromotion');
  if (!promotionData) throw new Error('promotionData manquant pour updatePromotion');
  return apiRequest(`/promotions/${promotionId}`, { method: 'PUT', body: promotionData });
};

// Supprimer une promotion
export const deletePromotion = (promotionId) => {
  if (!promotionId) throw new Error('promotionId manquant pour deletePromotion');
  return apiRequest(`/promotions/${promotionId}`, { method: 'DELETE' });
};

// Récupérer le locationId d'une promotion
export const getPromotionLocation = (supermarketId, createdBy) => {
  if (!supermarketId) throw new Error('supermarketId manquant pour getPromotionLocation');
  if (!createdBy) throw new Error('createdBy manquant pour getPromotionLocation');
  return apiRequest(`/promotion-location?supermarketId=${supermarketId}&createdBy=${createdBy}`, { method: 'GET' });
};