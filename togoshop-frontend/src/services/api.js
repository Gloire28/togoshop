import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.1.65:5000/api';

// Fonction générique pour gérer les requêtes API avec gestion des erreurs et des tokens
const apiRequest = async (endpoint, method = 'GET', body = null, isFormData = false) => {
  try {
    const token = await AsyncStorage.getItem('token');
    console.log('Token envoyé dans la requête:', token);
    if (!token && !isFormData && endpoint !== '/auth/login') {
      throw new Error('Aucun token trouvé dans AsyncStorage');
    }
    const headers = { 'Content-Type': isFormData ? 'multipart/form-data' : 'application/json' };
    if (token && !isFormData) headers['Authorization'] = `Bearer ${token}`;
    console.log('Headers envoyés:', headers);
    const response = await fetch(`${BASE_URL}${endpoint}`, { method, headers, body: body ? (isFormData ? body : JSON.stringify(body)) : null });
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

// Récupérer la liste des supermarchés
export const getSupermarkets = () => apiRequest('/supermarkets');

// Récupérer les produits d’un supermarché pour une localisation donnée
export const getProducts = (supermarketId, locationId) => {
  if (!supermarketId || !locationId) throw new Error('Paramètres manquants');
  return apiRequest(`/products/supermarket/${supermarketId}?locationId=${locationId}`);
};

// Récupérer les promotions actives
export const getPromotions = () => apiRequest('/promotions');

// Créer une nouvelle commande
export const createOrder = (orderData) => apiRequest('/orders', 'POST', orderData);

// Récupérer le panier de l’utilisateur (utilisé dans AppContext et CartScreen)
export const getUserCart = () => apiRequest('/orders/user/cart');

// Mettre à jour une commande (utilisé pour modifier quantités, commentaires, supprimer produits, ou adresse)
export const updateOrder = (orderId, orderData) => {
  if (!orderId) throw new Error('orderId manquant pour updateOrder');
  return apiRequest(`/orders/${orderId}`, 'PUT', orderData);
};

// Télécharger une photo pour une commande
export const uploadPhoto = (orderId, formData) => apiRequest(`/orders/${orderId}/upload-photo`, 'POST', formData, true);

// Connexion utilisateur
export const login = (credentials) => apiRequest('/auth/login', 'POST', credentials);

// Ajouter un produit au panier (utilisé dans CatalogueScreen)
export const addToCartAPI = (cartItem) => {
  if (!cartItem.supermarketId || !cartItem.locationId) {
    throw new Error('supermarketId et locationId sont requis pour ajouter un produit au panier');
  }
  console.log('cartItem reçu dans addToCartAPI:', cartItem);
  const body = { products: [cartItem] };
  console.log('Données envoyées à addToCartAPI:', body);
  return apiRequest('/orders/user/cart', 'POST', body);
};

// Appliquer un code promo à une commande (utilisé dans CartScreen pour les réductions)
export const applyPromotion = (promoCode, orderId) => apiRequest('/promotions/apply', 'POST', { code: promoCode, orderId });

// Récupérer les points de fidélité de l’utilisateur (utilisé dans CartScreen)
export const getUserLoyalty = () => apiRequest('/loyalty/me');

// Utiliser des points de fidélité pour une réduction (utilisé dans CartScreen)
export const redeemPoints = (points, orderId) => apiRequest('/loyalty/redeem', 'POST', { points, orderId });