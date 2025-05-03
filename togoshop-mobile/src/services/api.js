import axios from 'axios';

const API_URL = 'http://localhost:5000/api'; // À remplacer par l'URL de production

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // À adapter pour AsyncStorage
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

export const login = (credentials) => api.post('/auth/login', credentials);
export const register = (userData) => api.post('/auth/register', userData);
export const getSupermarkets = () => api.get('/supermarkets');
export const getProducts = (supermarketId) => api.get(`/products?supermarketId=${supermarketId}`);
export const createOrder = (orderData) => api.post('/orders', orderData);
export const getPendingOrders = (supermarketId) => api.get(`/orders/supermarket/${supermarketId}/pending`);
export const updateOrderStatus = (orderId, status) => api.put(`/orders/${orderId}/status`, { status });
export const registerDriver = (driverData) => api.post('/drivers/register', driverData);
export const updateDriverLocation = (location) => api.put('/drivers/location', location);

export default api;