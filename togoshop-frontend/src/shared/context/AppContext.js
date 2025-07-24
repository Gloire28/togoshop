import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { apiRequest, getPromotions, getUserCart, addToCartAPI, getManagerInfo, getUserLoyalty, redeemPoints, cancelOrder, updateOrder } from '../services/api';

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
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyPointsUsed, setLoyaltyPointsUsed] = useState(0);
  const [loyaltyReductionAmount, setLoyaltyReductionAmount] = useState(0);

  useEffect(() => {
    const loadAuth = async () => {
      const token = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      if (token && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          if (parsedUser.role === 'client') {
            const loyaltyData = await getUserLoyalty();
            setLoyaltyPoints(loyaltyData.points || 0);
          }
        } catch (error) {
          if (error.message === 'jwt expired') {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            setUser(null);
            setCart([]);
            setLoyaltyPoints(0);
            setLoyaltyPointsUsed(0);
            setLoyaltyReductionAmount(0);
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
      setLoyaltyPointsUsed(0);
      setLoyaltyReductionAmount(0);
      setLoadingCart(false);
    }
  }, [user]);

  const fetchCart = useCallback(async () => {
    if (!user || user.role !== 'client') {
      setLoadingCart(false);
      return { orderId: null, cart: [], loyaltyPointsUsed: 0, loyaltyReductionAmount: 0 };
    }
    if (isFetchingCart) return { orderId: null, cart: [], loyaltyPointsUsed: 0, loyaltyReductionAmount: 0 };
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
      setLoyaltyPointsUsed(response.loyaltyPointsUsed || 0);
      setLoyaltyReductionAmount(response.loyaltyReductionAmount || 0);
      setError(null);
      const loyaltyData = await getUserLoyalty();
      setLoyaltyPoints(loyaltyData.points || 0);
      console.log('Panier synchronisé:', {
        orderId: response.orderId,
        productCount: mappedCart.length,
        loyaltyPointsUsed: response.loyaltyPointsUsed,
        loyaltyReductionAmount: response.loyaltyReductionAmount,
        totalAmount: response.totalAmount,
      });
      return { 
        orderId: response.orderId || (response.length > 0 ? response[0].orderId : null), 
        cart: mappedCart,
        loyaltyPointsUsed: response.loyaltyPointsUsed || 0,
        loyaltyReductionAmount: response.loyaltyReductionAmount || 0
      };
    } catch (error) {
      console.error('Erreur détaillée lors du chargement du panier:', error.message);
      if (error.message === 'jwt expired') {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        setUser(null);
        setCart([]);
        setLoyaltyPoints(0);
        setLoyaltyPointsUsed(0);
        setLoyaltyReductionAmount(0);
        setError('Session expirée, veuillez vous reconnecter');
      } else {
        setError(error.message);
      }
      return { orderId: null, cart: [], loyaltyPointsUsed: 0, loyaltyReductionAmount: 0 };
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
        if (userData.role === 'client') {
          const loyaltyData = await getUserLoyalty();
          setLoyaltyPoints(loyaltyData.points || 0);
        }
      } catch (error) {
        if (error.message === 'jwt expired') {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          setUser(null);
          setCart([]);
          setLoyaltyPoints(0);
          setLoyaltyPointsUsed(0);
          setLoyaltyReductionAmount(0);
          setError('Session expirée, veuillez vous reconnecter');
        } else {
          setError(error.message);
        }
      }
    }
  }, []);

  const applyLoyaltyPoints = useCallback(async (points, orderId) => {
    if (!user || user.role !== 'client') {
      const errorMessage = 'Utilisateur non connecté ou non autorisé';
      setError(errorMessage);
      Alert.alert('Erreur', errorMessage);
      return { success: false, error: errorMessage };
    }
    if (!Number.isInteger(points) || points <= 0) {
      const errorMessage = 'Le nombre de points doit être un entier positif';
      setError(errorMessage);
      Alert.alert('Erreur', errorMessage);
      return { success: false, error: errorMessage };
    }
    if (points > loyaltyPoints) {
      const errorMessage = 'Points insuffisants pour cette opération';
      setError(errorMessage);
      Alert.alert('Erreur', errorMessage);
      return { success: false, error: errorMessage };
    }
    if (cart.length === 0) {
      const errorMessage = 'Le panier est vide, impossible d’utiliser des points';
      setError(errorMessage);
      Alert.alert('Erreur', errorMessage);
      return { success: false, error: errorMessage };
    }
    console.log('Avant application des points:', { points, orderId, cartLength: cart.length, loyaltyPoints });
    try {
      const response = await redeemPoints(points, orderId);
      setLoyaltyPointsUsed(response.loyalty?.pointsUsed || points);
      setLoyaltyReductionAmount(response.reductionAmount || 0);
      setLoyaltyPoints(response.loyalty?.points || 0);
      await fetchCart(); // Synchroniser le panier
      setError(null);
      console.log('Après application des points:', {
        loyaltyPointsUsed: response.loyalty?.pointsUsed || points,
        loyaltyReductionAmount: response.reductionAmount,
        remainingPoints: response.loyalty?.points || 0,
      });
      Alert.alert('Succès', `Vous avez utilisé ${points} points pour une réduction de ${response.reductionAmount} FCFA.`);
      return { success: true, reductionAmount: response.reductionAmount };
    } catch (error) {
      console.error('Erreur lors de l’application des points:', error.message);
      let errorMessage = 'Impossible d’utiliser les points de fidélité.';
      if (error.message.includes('Points insuffisants')) {
        errorMessage = 'Vous n\'avez pas assez de points de fidélité.';
      } else if (error.message.includes('cart_in_progress')) {
        errorMessage = 'Les points ne peuvent être utilisés que sur un panier en cours.';
      }
      setError(errorMessage);
      Alert.alert('Erreur', errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [user, loyaltyPoints, cart, fetchCart]);

  const cancelOrderAndRefundPoints = useCallback(async (orderId) => {
    if (!user || user.role !== 'client') {
      const errorMessage = 'Utilisateur non connecté ou non autorisé';
      setError(errorMessage);
      Alert.alert('Erreur', errorMessage);
      return { success: false, error: errorMessage };
    }
    console.log('Annulation de la commande:', { orderId });
    try {
      const response = await cancelOrder(orderId);
      setCart([]);
      setLoyaltyPointsUsed(0);
      setLoyaltyReductionAmount(0);
      const loyaltyData = await getUserLoyalty();
      setLoyaltyPoints(loyaltyData.points || 0);
      setError(null);
      const message = response.loyalty && response.loyalty.points
        ? `Commande annulée. ${response.loyalty.points} points remboursés.`
        : 'Commande annulée avec succès.';
      console.log('Résultat de l’annulation:', { message, points: loyaltyData.points });
      Alert.alert('Succès', message);
      return { success: true, loyalty: response.loyalty };
    } catch (error) {
      console.error('Erreur lors de l’annulation de la commande:', error.message);
      setError(error.message);
      Alert.alert('Erreur', error.message || 'Impossible d’annuler la commande.');
      return { success: false, error: error.message };
    }
  }, [user]);

  const addToCart = useCallback(async (product) => {
    if (!user || !product._id || !product.supermarketId || !product.locationId) {
      const errorMessage = 'Impossible d’ajouter le produit : utilisateur ou données manquantes.';
      setError(errorMessage);
      Alert.alert('Erreur', errorMessage);
      return { success: false, error: errorMessage };
    }
    if (loyaltyPointsUsed > 0 && (product.supermarketId !== selectedSupermarket || product.locationId !== selectedLocationId)) {
      const errorMessage = 'Impossible d’ajouter un produit d’un autre supermarché ou emplacement avec des points de fidélité utilisés.';
      setError(errorMessage);
      Alert.alert('Erreur', errorMessage);
      return { success: false, error: errorMessage };
    }
    console.log('Ajout au panier:', { productId: product._id, supermarketId: product.supermarketId, locationId: product.locationId });
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
      await fetchCart();
      setError(null);
      return { success: true };
    } catch (error) {
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
      console.error('Erreur lors de l’ajout au panier:', error.message);
      setError(error.message);
      Alert.alert('Erreur', error.message || 'Impossible d’ajouter le produit.');
      return { success: false, error: error.message };
    }
  }, [user, fetchCart, loyaltyPointsUsed, selectedSupermarket, selectedLocationId]);

  const removeFromCart = useCallback(async (productId, orderId) => {
    console.log('Suppression du produit du panier:', { productId, orderId });
    setCart(prev => {
      const updatedCart = prev.filter(item => item.productId !== productId);
      if (updatedCart.length === 0 && loyaltyPointsUsed > 0) {
        setLoyaltyPointsUsed(0);
        setLoyaltyReductionAmount(0);
      }
      return updatedCart;
    });
    try {
      if (orderId) {
        const updatedProducts = cart.filter(item => item.productId !== productId).map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          comment: item.comment,
          alternativeLocationId: item.alternativeLocationId,
          promotedPrice: item.promotedPrice,
        }));
        await updateOrder(orderId, { products: updatedProducts });
        await fetchCart();
      }
      setError(null);
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la suppression du produit:', error.message);
      setError(error.message);
      Alert.alert('Erreur', error.message || 'Impossible de supprimer le produit.');
      return { success: false, error: error.message };
    }
  }, [cart, loyaltyPointsUsed, fetchCart]);

  const updateCartQuantity = useCallback(async (productId, quantity, orderId) => {
    console.log('Mise à jour de la quantité:', { productId, quantity, orderId });
    setCart(prev => {
      const updatedCart = prev
        .map(item => (item.productId === productId ? { ...item, quantity: Math.max(0, quantity) } : item))
        .filter(item => item.quantity > 0);
      if (updatedCart.length === 0 && loyaltyPointsUsed > 0) {
        setLoyaltyPointsUsed(0);
        setLoyaltyReductionAmount(0);
      }
      return updatedCart;
    });
    try {
      if (orderId) {
        const updatedProducts = cart
          .map(item => (item.productId === productId ? { ...item, quantity: Math.max(0, quantity) } : item))
          .filter(item => item.quantity > 0)
          .map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            comment: item.comment,
            alternativeLocationId: item.alternativeLocationId,
            promotedPrice: item.promotedPrice,
          }));
        await updateOrder(orderId, { products: updatedProducts });
        await fetchCart();
      }
      setError(null);
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la quantité:', error.message);
      setError(error.message);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour la quantité.');
      return { success: false, error: error.message };
    }
  }, [cart, loyaltyPointsUsed, fetchCart]);

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
        loyaltyPoints,
        setLoyaltyPoints,
        loyaltyPointsUsed,
        setLoyaltyPointsUsed,
        loyaltyReductionAmount,
        setLoyaltyReductionAmount,
        applyLoyaltyPoints,
        cancelOrderAndRefundPoints,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};