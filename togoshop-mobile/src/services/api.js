import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL =
  " https://6d80-2c0f-f0f8-8ae-3000-b586-3442-ee3d-e9ae.ngrok-free.app/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "Ngrok-Skip-Browser-Warning": "true",
  },
  timeout: 10000,
  withCredentials: false,
});

// Intercepteur pour ajouter le token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error("Erreur requête:", error);
    return Promise.reject(error);
  },
);

// Intercepteur de réponse unique optimisé
api.interceptors.response.use(
  (response) => {
    console.log("Réponse API:", {
      status: response.status,
      url: response.config.url,
      data: response.data,
    });
    return response;
  },
  (error) => {
    const errorDetails = {
      config: error.config,
      response: error.response
        ? {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers,
          }
        : null,
      message: error.message,
    };

    console.error("Erreur API complète:", errorDetails);

    if (error.response?.status === 401) {
      console.warn("Token expiré ou invalide");
    }

    return Promise.reject(error);
  },
);

// Fonctions API
export const login = (credentials) => api.post("/auth/login", credentials);
export const register = (userData) => api.post("/auth/register", userData);

export const getSupermarkets = () => {
  console.log("Fetching supermarkets...");
  return api.get("/supermarkets");
};

export const getSupermarket = (supermarketId) => {
  console.log(`Fetching supermarket with ID: ${supermarketId}...`);
  return api.get(`/supermarkets/${supermarketId}`);
};

export const getProducts = (supermarketId, locationId, category = null) => {
  console.log(
    `Fetching products for supermarket ${supermarketId} at location ${locationId}${category ? `, category ${category}` : ""}...`,
  );
  const query = category
    ? `locationId=${locationId}&category=${encodeURIComponent(category)}`
    : `locationId=${locationId}`;
  return api.get(`/products/supermarket/${supermarketId}?${query}`);
};

export const getProductById = (productId) => api.get(`/products/${productId}`);

export const createOrder = (orderData) => api.post("/orders", orderData);

export const getPendingOrders = (supermarketId) =>
  api.get(`/orders/supermarket/${supermarketId}/pending`);

export const updateOrderStatus = (orderId, status) =>
  api.put(`/orders/${orderId}/status`, { status });

export const registerDriver = (driverData) =>
  api.post("/drivers/register", driverData);

export const updateDriverLocation = (location) =>
  api.put("/drivers/location", location);

export const getTracking = (orderId) => api.get(`/tracking/${orderId}`);

export const getPromotions = () => api.get("/promotions");

export const applyPromotion = (data) =>
  api.post("/orders/apply-promotion", data);

export const createNotification = (notificationData) =>
  api.post("/notifications", notificationData);

export const getSubstitutes = (category, supermarketId, locationId) =>
  api.get(`/products/substitutes/${category}/${supermarketId}/${locationId}`);

export const getUserProfile = () => api.get("/users/me");

export const updateUserProfile = (userData) => api.put("/users/me", userData);

export const getUserOrderHistory = () => api.get("/orders/user/history");

export const getWallet = () => api.get("/wallets/me");

export const depositFunds = (depositData) =>
  api.post("/wallets/deposit", depositData);

export const getUserNotifications = () => api.get("/notifications/user");

// Note : Les fonctions getSupermarkets et createPayment sont déjà utilisées par LocationSelectionScreen.
// Si tu as besoin d'une fonction spécifique pour récupérer des emplacements pour le paiement en "cash",
// tu peux ajouter une nouvelle fonction ici, par exemple :
// export const getCashPickupLocations = () => api.get("/locations/cash-pickup");

export default api;
