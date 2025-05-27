import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.1.81:5000/api';

export const apiRequest = async (endpoint, options = {}) => {
  const { method = 'GET', body = null, isFormData = false } = options;

  try {
    const token = await AsyncStorage.getItem('token');
    console.log('Token envoyé dans la requête:', token);

    if (!token && !isFormData && endpoint !== '/auth/login') {
      throw new Error('Aucun token trouvé dans AsyncStorage');
    }

    const headers = { 'Content-Type': isFormData ? 'multipart/form-data' : 'application/json' };
    if (token && !isFormData) headers['Authorization'] = `Bearer ${token}`;
    console.log('Headers envoyés:', headers);

    console.log(`Méthode utilisée pour ${endpoint}: ${method}`);

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? (isFormData ? body : JSON.stringify(body)) : null,
    });

    const text = await response.text();
    console.log(`Réponse brute (${endpoint}):`, text);

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
    console.log(`Données parsées (${endpoint}):`, data);
    return data;
  } catch (error) {
    console.log(`Erreur capturée dans apiRequest (${endpoint}):`, error.message, error);
    throw error;
  }
};

// Récupérer un supermarché par ID
export const getSupermarket = (supermarketId) => {
  if (!supermarketId) throw new Error('supermarketId manquant pour getSupermarket');
  return apiRequest(`/supermarkets/${supermarketId}`, { method: 'GET' });
};

// Récupérer la liste des supermarchés depuis l'API
export const getSupermarkets = () => apiRequest('/supermarkets', { method: 'GET' });

// Récupérer les produits d’un supermarché pour une localisation donnée
export const getProducts = (supermarketId, locationId) => {
  if (!supermarketId || !locationId) throw new Error('Paramètres manquants');
  return apiRequest(`/products/supermarket/${supermarketId}?locationId=${locationId}`, { method: 'GET' });
};

// Récupérer les promotions actives depuis l'API
export const getPromotions = () => apiRequest('/promotions', { method: 'GET' });

// Créer une nouvelle commande
export const createOrder = (orderData) => apiRequest('/orders', { method: 'POST', body: orderData });

// Récupérer le panier de l’utilisateur depuis l'API
export const getUserCart = () => apiRequest('/orders/user/cart', { method: 'GET' });

// Mettre à jour une commande existante
export const updateOrder = (orderId, orderData) => {
  if (!orderId) throw new Error('orderId manquant pour updateOrder');
  return apiRequest(`/orders/${orderId}`, { method: 'PUT', body: orderData });
};

// Mettre à jour le statut d'une commande
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
  console.log('cartItem reçu dans addToCartAPI:', cartItem);
  const body = { products: [cartItem] };
  console.log('Données envoyées à addToCartAPI:', body);
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