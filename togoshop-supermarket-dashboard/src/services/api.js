import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

export const getPendingOrders = (supermarketId) => api.get(`/orders/supermarket/${supermarketId}/pending`);
export const updateOrderStatus = (orderId, status) => api.put(`/orders/${orderId}/status`, { status });

export default api;