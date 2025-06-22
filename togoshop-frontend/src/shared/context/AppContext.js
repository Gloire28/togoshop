import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { apiRequest, getPromotions, getUserCart, addToCartAPI, getManagerInfo } from '../services/api';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [error, setError] = useState(null);
  const [isFetchingCart, setIsFetchingCart] = useState(false);

  useEffect(() => {
    const loadAuth = async () => {
      const token = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      if (token && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          console.log('User défini dans loadAuth:', parsedUser);
        } catch (error) {
          if (error.message === 'jwt expired') {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            console.log('Token expiré, utilisateur déconnecté');
            setUser(null);
            setCart([]);
          } else {
            setError(error.message);
            console.log('Erreur dans loadAuth:', error.message);
          }
        }
      } else if (token) {
        await refreshData();
      } else {
        console.log('Aucun token ou utilisateur trouvé dans AsyncStorage');
      }
      setLoadingCart(false);
    };
    loadAuth();
  }, []);

  useEffect(() => {
    if (user && user.role === 'client') {
      fetchCart();
    } else if (user) {
      console.log('fetchCart ignoré pour le rôle:', user.role);
      setCart([]);
      setLoadingCart(false);
    }
  }, [user]);

  const fetchCart = useCallback(async () => {
    if (!user || user.role !== 'client') {
      console.log('fetchCart ignoré, rôle non client:', user?.role);
      setLoadingCart(false);
      return { orderId: null, cart: [] };
    }
    if (isFetchingCart) {
      console.log('fetchCart déjà en cours, appel ignoré');
      return { orderId: null, cart: [] };
    }
    try {
      setIsFetchingCart(true);
      setLoadingCart(true);
      console.log('Appel de fetchCart avec user:', user);

      const token = await AsyncStorage.getItem('token');
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      if (tokenData.exp < currentTime) {
        console.log('Token expiré dans fetchCart, déconnexion');
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        setUser(null);
        setCart([]);
        setError('Session expirée, veuillez vous reconnecter');
        return { orderId: null, cart: [] };
      }

      const response = await getUserCart();
      console.log('Réponse getUserCart dans fetchCart:', JSON.stringify(response, null, 2));

      let products = [];
      if (response && response.products && Array.isArray(response.products)) {
        products = response.products;
      } else {
        console.log('Aucun produit dans le panier ou réponse invalide:', response);
        setCart([]);
        return { orderId: null, cart: [] };
      }

      const mappedCart = products.map(item => ({
        productId: item.productId || '',
        name: item.name || 'Produit inconnu',
        price: Number(item.price) || 0,
        weight: Number(item.weight) || 0,
        quantity: Number(item.quantity) || 1,
        comment: item.comment || '',
        alternativeLocationId: item.alternativeLocationId || '',
        stockByLocation: item.stockByLocation || [],
        promotedPrice: item.promotedPrice !== null && !isNaN(item.promotedPrice) ? Number(item.promotedPrice) : null,
      }));

      console.log('Cart normalisé:', JSON.stringify(mappedCart, null, 2));
      setCart(mappedCart);
      console.log('Cart mis à jour dans l\'état:', JSON.stringify(mappedCart, null, 2));
      setError(null);
      return { orderId: response.orderId, cart: mappedCart };
    } catch (error) {
      console.error('Erreur détaillée lors du chargement du panier:', error.message);
      if (error.message === 'jwt expired') {
        console.log('Token expiré dans fetchCart, déconnexion');
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        setUser(null);
        setCart([]);
        setError('Session expirée, veuillez vous reconnecter');
      } else {
        setError(error.message);
      }
      return { orderId: null, cart: [] };
    } finally {
      setLoadingCart(false);
      setIsFetchingCart(false);
    }
  }, [user]);

  const refreshData = useCallback(async () => {
    console.log('Appel de refreshData');
    const token = await AsyncStorage.getItem('token');
    if (token) {
      try {
        const userData = await getManagerInfo();
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        console.log('User mis à jour dans refreshData:', userData);
      } catch (error) {
        console.error('Erreur dans refreshData:', error.message);
        if (error.message === 'jwt expired') {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          setUser(null);
          setCart([]);
        }
        setError(error.message);
      }
    }
  }, []);

  const refreshCart = useCallback(async () => {
    console.log('Appel de refreshCart');
    const result = await fetchCart();
    return result.cart;
  }, [fetchCart]);

  const updateLocalCart = useCallback((updatedCart) => {
    console.log('Mise à jour locale du panier:', updatedCart);
    setCart(updatedCart);
  }, []);

  const addToCart = async (product) => {
    if (!user || !product._id || !product.supermarketId || !product.locationId) {
      const errorMessage = 'Impossible d’ajouter le produit : utilisateur ou données manquantes.';
      console.log(errorMessage, { user, product });
      setError(errorMessage);
      Alert.alert('Erreur', errorMessage);
      return { success: false, error: errorMessage };
    }
    console.log('Produit reçu dans addToCart:', product);
    const cartItem = {
      productId: product._id,
      quantity: 1,
      locationId: product.locationId,
      supermarketId: product.supermarketId,
      promotedPrice: product.promotedPrice || null,
    };
    try {
      console.log('Ajout au panier, cartItem envoyé:', cartItem);
      const response = await addToCartAPI(cartItem);
      console.log('Réponse addToCartAPI:', response);
      const fetchResult = await fetchCart();
      if (fetchResult.cart) {
        console.log('Panier mis à jour avec succès après ajout');
      } else {
        console.warn('Échec de la mise à jour du panier après ajout');
      }
      setError(null);
      return { success: true };
    } catch (error) {
      console.error('Erreur ajout panier:', error.message);
      setError(error.message);
      Alert.alert('Erreur', error.message || 'Impossible d’ajouter le produit.');
      return { success: false, error: error.message };
    }
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(item => item.productId !== productId));
  const updateCartQuantity = (productId, quantity) =>
    setCart(prev =>
      prev
        .map(item => (item.productId === productId ? { ...item, quantity: Math.max(0, quantity) } : item))
        .filter(item => item.quantity > 0)
    );
  const updateCartComment = (productId, comment) =>
    setCart(prev => prev.map(item => (item.productId === productId ? { ...item, comment } : item)));
  const updateCartPhoto = (productId, photoUrl) =>
    setCart(prev => prev.map(item => (item.productId === productId ? { ...item, photoUrl } : item)));

  const setCartFromAPI = (newCart) => {
    setCart(newCart);
  };

  return (
    <AppContext.Provider
      value={{
        cart,
        setCart,
        setCartFromAPI,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        updateCartComment,
        updateCartPhoto,
        user,
        setUser,
        promotions,
        setPromotions,
        loadingCart,
        error,
        fetchCart,
        refreshData,
        refreshCart,
        updateLocalCart,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};