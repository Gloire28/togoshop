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
  const [supermarkets, setSupermarkets] = useState([]);
  const [selectedSupermarket, setSelectedSupermarket] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [supermarketStatus, setSupermarketStatus] = useState(null);
  const [shouldRefreshData, setShouldRefreshData] = useState(false);

  useEffect(() => {
    const loadAuth = async () => {
      const token = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      if (token && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (error) {
          if (error.message === 'jwt expired') {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            setUser(null);
            setCart([]);
          } else {
            setError(error.message);
          }
        }
      }
      setLoadingCart(false);
    };
    loadAuth();
  }, []);

  useEffect(() => {
    if (user && user.role === 'client') {
      fetchCart();
    } else if (user) {
      setCart([]);
      setLoadingCart(false);
    }
  }, [user]);

  const fetchCart = useCallback(async () => {
    if (!user || user.role !== 'client') {
      setLoadingCart(false);
      return { orderId: null, cart: [] };
    }
    if (isFetchingCart) return { orderId: null, cart: [] };
    try {
      setIsFetchingCart(true);
      setLoadingCart(true);
      const response = await getUserCart();
      let products = [];
      if (response && Array.isArray(response.products)) {
        products = response.products;
      } else if (response && Array.isArray(response)) {
        products = response;
      }
      const mappedCart = products.map(item => ({
        productId: item.productId?._id || item.productId || '',
        name: item.productId?.name || item.name || 'Produit inconnu',
        price: Number(item.productId?.price) || Number(item.price) || 0,
        weight: Number(item.productId?.weight) || Number(item.weight) || 0,
        quantity: Number(item.quantity) || 1,
        comment: item.comment || '',
        alternativeLocationId: item.alternativeLocationId || '',
        stockByLocation: item.productId?.stockByLocation || item.stockByLocation || [],
        imageUrl: item.productId?.imageUrl || item.imageUrl || 'https://via.placeholder.com/150',
        promotedPrice: (item.promotedPrice !== null && !isNaN(item.promotedPrice)) 
          ? Number(item.promotedPrice) 
          : (item.productId?.promotedPrice !== null && !isNaN(item.productId?.promotedPrice))
            ? Number(item.productId?.promotedPrice)
            : null,
      }));
      setCart(mappedCart);
      setError(null);
      return { orderId: response.orderId || (response.length > 0 ? response[0].orderId : null), cart: mappedCart };
    } catch (error) {
      console.error('Erreur détaillée lors du chargement du panier:', error.message);
      if (error.message === 'jwt expired') {
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
    const token = await AsyncStorage.getItem('token');
    if (token) {
      try {
        const userData = await getManagerInfo();
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      } catch (error) {
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

  const addToCart = useCallback(async (product) => {
    if (!user || !product._id || !product.supermarketId || !product.locationId) {
      const errorMessage = 'Impossible d’ajouter le produit : utilisateur ou données manquantes.';
      setError(errorMessage);
      Alert.alert('Erreur', errorMessage);
      return { success: false, error: errorMessage };
    }

    // Mise à jour locale optimiste
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === product._id);
      
      if (existingItem) {
        return prevCart.map(item => 
          item.productId === product._id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      } else {
        return [
          ...prevCart,
          {
            productId: product._id,
            name: product.name,
            price: product.price,
            weight: product.weight,
            quantity: 1,
            imageUrl: product.imageUrl,
            promotedPrice: product.promotedPrice,
            stockByLocation: product.stockByLocation,
            locationId: product.locationId,
            supermarketId: product.supermarketId,
          }
        ];
      }
    });

    try {
      const cartItem = {
        productId: product._id,
        quantity: 1,
        locationId: product.locationId,
        supermarketId: product.supermarketId,
        promotedPrice: product.promotedPrice || null,
      };
      
      await addToCartAPI(cartItem);
      await fetchCart(); // Synchronisation avec le serveur
      
      setError(null);
      return { success: true };
    } catch (error) {
      // Annuler la mise à jour locale en cas d'erreur
      setCart(prevCart => {
        const existingItem = prevCart.find(item => item.productId === product._id);
        if (existingItem) {
          if (existingItem.quantity > 1) {
            return prevCart.map(item => 
              item.productId === product._id 
                ? { ...item, quantity: item.quantity - 1 } 
                : item
            );
          } else {
            return prevCart.filter(item => item.productId !== product._id);
          }
        } else {
          return prevCart;
        }
      });
      
      setError(error.message);
      Alert.alert('Erreur', error.message || 'Impossible d’ajouter le produit.');
      return { success: false, error: error.message };
    }
  }, [user, fetchCart]);

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

  return (
    <AppContext.Provider
      value={{
        cart,
        setCart,
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
        setError,
        fetchCart,
        shouldRefreshData,
        setShouldRefreshData,
        supermarkets,
        setSupermarkets,
        selectedSupermarket,
        setSelectedSupermarket,
        locations,
        setLocations,
        selectedLocationId,
        setSelectedLocationId,
        products,
        setProducts,
        loading,
        setLoading,
        supermarketStatus,
        setSupermarketStatus,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};