import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.1.89:5000/api';

export const apiRequest = async (endpoint, options = {}) => {
  const { method = 'GET', body = null, isFormData = false } = options;

  try {
    const token = await AsyncStorage.getItem('token');
    console.log('Token envoyé dans la requête:', token);
    console.log('Requête envoyée:', `${BASE_URL}${endpoint}`, { method, headers: { 'Content-Type': isFormData ? 'multipart/form-data' : 'application/json', ...(token && { Authorization: `Bearer ${token}` }) } });

    // Exclure les endpoints qui ne nécessitent pas de token
    if (!token && !isFormData && endpoint !== '/auth/login' && endpoint !== '/drivers/login' && endpoint !== '/auth/register') {
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
    if (error.message.includes('Network request failed')) {
      throw new Error('Problème de connexion, vérifiez votre réseau.');
    }
    throw error;
  }
};

// Uploader une image pour un produit
export const uploadProductImage = async (image) => {
  const formData = new FormData();
  formData.append('image', {
    uri: image.uri,
    type: image.mimeType || 'image/jpeg',
    name: image.fileName || `product_image_${Date.now()}.jpg`,
  });

  try {
    const response = await apiRequest('/products/upload-image', {
      method: 'POST',
      body: formData,
      isFormData: true,
    });
    return response;
  } catch (error) {
    throw new Error(`Échec de l'upload de l'image : ${error.message}`);
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
    const products = productsData.data || productsData; 

    // Ajout de validation pour imageUrl avec meilleure gestion des erreurs
    const enrichedProducts = products.map(product => ({
      ...product,
      imageUrl: product.imageUrl ? product.imageUrl : 'https://via.placeholder.com/150', // Fallback image
    }));

    console.log('Produits récupérés avec promotedPrice:', enrichedProducts);
    return enrichedProducts; 
  } catch (error) {
    throw error;
  }
};

// Récupérer les promotions actives
export const getPromotions = () => apiRequest('/promotions', { method: 'GET' });

// Créer une nouvelle commande
export const createOrder = (orderData) => {
  if (!orderData.products || !orderData.supermarketId || !orderData.locationId) {
    throw new Error('products, supermarketId et locationId sont requis pour createOrder');
  }
  return apiRequest('/orders', { method: 'POST', body: orderData });
};

// Récupérer le panier de l’utilisateur
export const getUserCart = () => {
  return apiRequest('/orders/user/cart', { method: 'GET' }).then(response => {
    if (response && response.products) {
      const hasImageUrl = response.products.every(product => product.productId?.imageUrl);
      if (!hasImageUrl) {
        console.warn('Attention : Certains produits manquent d\'imageUrl dans getUserCart');
      }
      if (response.loyaltyReductionAmount || response.loyaltyPointsUsed) {
        console.log('Panier récupéré avec points de fidélité:', {
          loyaltyPointsUsed: response.loyaltyPointsUsed,
          loyaltyReductionAmount: response.loyaltyReductionAmount,
          totalAmount: response.totalAmount,
        });
      }
    }
    return response;
  });
};

// Soumettre une commande
export const submitOrder = (orderId, submitData) => {
  if (!orderId) throw new Error('orderId manquant pour submitOrder');
  if (!submitData.paymentMethod || !submitData.deliveryType) {
    throw new Error('paymentMethod et deliveryType sont requis pour submitOrder');
  }
  if (submitData.loyaltyPoints && (!Number.isInteger(submitData.loyaltyPoints) || submitData.loyaltyPoints < 0)) {
    throw new Error('Le nombre de points de fidélité doit être un entier positif ou zéro');
  }
  console.log('Envoi de submitOrder:', { orderId, submitData });
  return apiRequest(`/orders/${orderId}/submit`, { method: 'PUT', body: submitData }).then(response => {
    if (response && response.order && (response.order.loyaltyReductionAmount || response.order.loyaltyPointsUsed)) {
      console.log('Commande soumise avec points de fidélité:', {
        loyaltyPointsUsed: response.order.loyaltyPointsUsed,
        loyaltyReductionAmount: response.order.loyaltyReductionAmount,
        totalAmount: response.order.totalAmount,
      });
    }
    return response;
  });
};

// Mettre à jour une commande existante
export const updateOrder = (orderId, orderData) => {
  if (!orderId) throw new Error('orderId manquant pour updateOrder');
  if (!orderData.products || !Array.isArray(orderData.products)) {
    throw new Error('products doit être un tableau pour updateOrder');
  }
  if (orderData.loyaltyPoints && (!Number.isInteger(orderData.loyaltyPoints) || orderData.loyaltyPoints < 0)) {
    throw new Error('Le nombre de points de fidélité doit être un entier positif ou zéro');
  }
  console.log('Envoi de updateOrder:', { orderId, orderData });
  return apiRequest(`/orders/${orderId}`, { method: 'PUT', body: orderData }).then(response => {
    if (response && response.order && (response.order.loyaltyReductionAmount || response.order.loyaltyPointsUsed)) {
      console.log('Commande mise à jour avec points de fidélité:', {
        loyaltyPointsUsed: response.order.loyaltyPointsUsed,
        loyaltyReductionAmount: response.order.loyaltyReductionAmount,
        totalAmount: response.order.totalAmount,
      });
    }
    return response;
  });
};

// Mettre à jour le statut d'une commande (côté client/manager)
export const updateOrderStatus = (orderId, status) => {
  if (!orderId || !status) throw new Error('orderId ou status manquant pour updateOrderStatus');
  return apiRequest(`/orders/${orderId}/status`, { method: 'PUT', body: { status } });
};

// Télécharger une photo pour une commande
export const uploadPhoto = (orderId, formData) => apiRequest(`/orders/${orderId}/upload-photo`, { method: 'POST', body: formData, isFormData: true });

// Connexion utilisateur
export const login = (credentials) => {
  const { name, phone } = credentials;
  if (!name || !phone) throw new Error('Nom et numéro de téléphone sont requis');
  return apiRequest('/auth/login', { method: 'POST', body: { name, phone } });
};

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
export const getUserLoyalty = () => {
  return apiRequest('/loyalty/me', { method: 'GET' }).then(response => {
    console.log('Points de fidélité récupérés:', {
      points: response.points,
      transactions: response.transactions,
    });
    return response;
  });
};

// Utiliser des points de fidélité pour une réduction
export const redeemPoints = async (points, orderId) => {
  if (!points || !Number.isInteger(points) || points <= 0) {
    throw new Error('Le nombre de points doit être un entier positif');
  }
  if (!orderId) {
    throw new Error('orderId manquant pour redeemPoints');
  }
  console.log('Envoi de redeemPoints:', { points, orderId });
  try {
    const response = await apiRequest('/loyalty/redeem', { method: 'POST', body: { points, orderId } });
    if (response && response.reductionAmount) {
      console.log('Réduction appliquée:', {
        pointsUsed: points,
        reductionAmount: response.reductionAmount,
        remainingPoints: response.points,
      });
    }
    // Note : Après redeemPoints, appeler getUserCart ou getOrderDetails pour mettre à jour l'affichage du panier
    return response;
  } catch (error) {
    if (error.message.includes('Points insuffisants')) {
      throw new Error('Vous n\'avez pas assez de points de fidélité');
    }
    if (error.message.includes('cart_in_progress')) {
      throw new Error('Les points ne peuvent être utilisés que sur un panier en cours');
    }
    throw error;
  }
};

// Rembourser des points de fidélité pour une commande annulée
export const refundPoints = (orderId) => {
  if (!orderId) {
    throw new Error('orderId manquant pour refundPoints');
  }
  console.log('Envoi de refundPoints:', { orderId });
  return apiRequest('/loyalty/refund', { method: 'POST', body: { orderId } }).then(response => {
    if (response && response.loyalty) {
      console.log('Points remboursés:', {
        points: response.loyalty.points,
        transactions: response.loyalty.transactions,
      });
    }
    return response;
  });
};

// Récupérer toutes les commandes de l’utilisateur
export const getUserOrders = () => apiRequest('/orders/user/me', { method: 'GET' });

// Récupérer les informations du manager
export const getManagerInfo = () => apiRequest('/managers/me', { method: 'GET' });

// Récupérer les commandes du manager
export const getManagerOrders = () => apiRequest('/orders/manager', { method: 'GET' });

// Connexion d’un livreur
export const loginDriver = (credentials) => {
  const { name, phoneNumber } = credentials;
  return apiRequest('/drivers/login', { method: 'POST', body: { name, phoneNumber } });
};

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
  console.log(`Appel getOrderDetails pour orderId: ${orderId}`);
  const timestamp = new Date().getTime(); // Ajout d'un timestamp pour éviter le cache
  return apiRequest(`/orders/${orderId}?t=${timestamp}`, { method: 'GET' });
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

// Inscription d'un utilisateur
export const registerUser = (userData) => {
  if (!userData || !userData.name || !userData.name.trim() || !userData.email || !userData.email.trim() || !userData.phone || !userData.phone.trim() || !userData.password || !userData.password.trim()) {
    console.log('Données envoyées à registerUser:', userData);
    throw new Error('Tous les champs (name, email, phone, password) sont requis pour registerUser');
  }
  console.log('Données envoyées à /auth/register:', userData);
  return apiRequest('/auth/register', { method: 'POST', body: userData });
};

// Annuler une commande
export const cancelOrder = async (orderId) => {
  if (!orderId) throw new Error('orderId manquant pour cancelOrder');
  try {
    const response = await apiRequest(`/orders/${orderId}`, { method: 'DELETE' });
    if (response && response.loyalty && response.loyalty.points) {
      console.log('Points remboursés après annulation:', response.loyalty.points);
    }
    return response;
  } catch (error) {
    throw error;
  }
};

// S'abonner à une notification
export const subscribeToNotification = (subscriptionData) => {
  if (!subscriptionData.type || !subscriptionData.entityId) {
    throw new Error('Type et entityId sont requis pour subscribeToNotification');
  }
  return apiRequest('/notifications/subscribe', { method: 'POST', body: subscriptionData });
};

// Récupérer les notifications de l'utilisateur
export const getNotifications = (page = 1, limit = 20, type) => {
  let url = `/notifications?page=${page}&limit=${limit}`;
  if (type) {
    url += `&type=${type}`;
  }
  return apiRequest(url, { method: 'GET' });
};

// Marquer une notification comme lue
export const markNotificationAsRead = (notificationId) => {
  if (!notificationId) throw new Error('notificationId manquant pour markNotificationAsRead');
  return apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' });
};

// Supprimer une notification
export const deleteNotification = (notificationId) => {
  if (!notificationId) throw new Error('notificationId manquant pour deleteNotification');
  return apiRequest(`/notifications/${notificationId}`, { method: 'DELETE' });
};

// Créer une notification (admin)
export const createAdminNotification = (notificationData) => {
  if (!notificationData.userId || !notificationData.title || !notificationData.message) {
    throw new Error('userId, title et message sont requis pour createAdminNotification');
  }
  return apiRequest('/notifications', { method: 'POST', body: notificationData });
};
