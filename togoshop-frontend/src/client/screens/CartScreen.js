import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../../shared/context/AppContext';
import { updateOrder, getUserLoyalty } from '../../shared/services/api';
import imageMap from '../../assets/imageMap';
import debounce from 'lodash.debounce';

// Composant pour la barre de progression
const ProgressBar = ({ currentStep }) => {
  const steps = [
    { label: 'Panier', step: 1 },
    { label: 'Livraison', step: 2 },
    { label: 'Paiement', step: 3 },
    { label: 'Confirmation', step: 4 },
  ];

  return (
    <View style={styles.progressBarContainer}>
      {steps.map((stepItem) => (
        <View key={stepItem.step} style={styles.progressStep}>
          <View
            style={[
              styles.progressCircle,
              currentStep >= stepItem.step ? styles.progressCircleActive : styles.progressCircleInactive,
            ]}
          >
            <Text
              style={[
                styles.progressText,
                currentStep >= stepItem.step ? styles.progressTextActive : styles.progressTextInactive,
              ]}
            >
              {stepItem.step}
            </Text>
          </View>
          <Text
            style={[
              styles.progressLabel,
              currentStep >= stepItem.step ? styles.progressLabelActive : styles.progressLabelInactive,
            ]}
          >
            {stepItem.label}
          </Text>
        </View>
      ))}
    </View>
  );
};

export default function CartScreen({ navigation }) {
  const {
    cart,
    setCart,
    fetchCart,
    loadingCart,
    error,
    user,
    loyaltyPoints,
    loyaltyPointsUsed,
    loyaltyReductionAmount,
    applyLoyaltyPoints,
    setLoyaltyPoints,
  } = useContext(AppContext);
  const [orderId, setOrderId] = useState(null);
  const [tempComments, setTempComments] = useState({});
  const [isSaving, setIsSaving] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);

  useEffect(() => {
    loadCartData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('CartScreen est actif, rafraîchissement du panier');
      loadCartData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCartData = async () => {
    try {
      const cartResponse = await fetchCart();
      console.log('Réponse loadCartData:', JSON.stringify(cartResponse, null, 2));
      
      if (cartResponse && cartResponse.orderId) {
        setOrderId(cartResponse.orderId);
        const cartItems = cartResponse.cart || [];
        setCart(cartItems);
        
        if (cartItems.length === 0) {
          setOrderId(null);
          setCart([]);
        }
      } else {
        console.log('Aucune commande valide ou panier vide:', cartResponse);
        setOrderId(null);
        setCart([]);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des données dans loadCartData:', err.message);
      setOrderId(null);
      setCart([]);
      Alert.alert('Erreur', 'Impossible de charger le panier : ' + err.message);
    }
  };

  const calculateSubtotal = useCallback(() => {
    const baseSubtotal = cart.reduce((total, item) => {
      const price = item.promotedPrice !== null && !isNaN(item.promotedPrice) ? item.promotedPrice : item.price || 0;
      return total + price * (item.quantity || 1);
    }, 0);
    const total = Math.max(0, baseSubtotal - loyaltyReductionAmount);
    console.log('Calcul du sous-total:', { baseSubtotal, loyaltyReductionAmount, total });
    return Number(total.toFixed(2));
  }, [cart, loyaltyReductionAmount]);

  const debouncedFetchCart = debounce(async () => {
    try {
      setIsUpdating(true);
      console.log('Déclenchement de debouncedFetchCart');
      const cartResponse = await fetchCart();
      console.log('Réponse debouncedFetchCart:', JSON.stringify(cartResponse, null, 2));
    } catch (err) {
      console.error('Erreur lors du rafraîchissement du panier:', err.message);
    } finally {
      setIsUpdating(false);
    }
  }, 1000);

  const updateQuantity = async (productId, newQuantity) => {
    if (newQuantity < 1 || !orderId) return;
    try {
      const updatedCart = cart.map(item =>
        item.productId === productId ? { ...item, quantity: newQuantity } : item
      );
      setCart(updatedCart);
      setIsSaving(prev => ({ ...prev, [productId]: true }));
      setIsUpdating(true);
      const updatedProducts = updatedCart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        comment: item.comment || '',
        alternativeLocationId: item.alternativeLocationId || '',
        promotedPrice: item.promotedPrice !== null ? item.promotedPrice : null,
      }));
      console.log('Corps envoyé à updateOrder:', { orderId, orderData: { products: updatedProducts } });
      await updateOrder(orderId, { products: updatedProducts });
      await debouncedFetchCart();
    } catch (err) {
      console.error('Erreur dans updateQuantity:', err.message);
      Alert.alert('Erreur', 'Impossible de mettre à jour la quantité : ' + err.message);
      await loadCartData();
    } finally {
      setIsSaving(prev => ({ ...prev, [productId]: false }));
      setIsUpdating(false);
    }
  };

  const removeFromCart = async (productId) => {
    if (!orderId) return;
    Alert.alert('Confirmer la suppression', 'Voulez-vous supprimer ce produit du panier ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            const updatedCart = cart.filter(item => item.productId !== productId);
            setCart(updatedCart);
            setIsUpdating(true);
            const updatedProducts = updatedCart.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              comment: item.comment || '',
              alternativeLocationId: item.alternativeLocationId || '',
              promotedPrice: item.promotedPrice !== null ? item.promotedPrice : null,
              locationId: item.locationId,
            }));
            console.log('Corps envoyé à updateOrder:', { orderId, orderData: { products: updatedProducts } });
            await updateOrder(orderId, { products: updatedProducts });
            await debouncedFetchCart();
          } catch (err) {
            console.error('Erreur dans removeFromCart:', err.message);
            Alert.alert('Erreur', 'Impossible de supprimer le produit : ' + err.message);
            await loadCartData();
          } finally {
            setIsUpdating(false);
          }
        },
      },
    ]);
  };

  const updateComment = async (productId, newComment) => {
    if (!orderId) return;
    try {
      setTempComments(prev => ({ ...prev, [productId]: newComment }));
      const updatedCart = cart.map(item =>
        item.productId === productId ? { ...item, comment: newComment } : item
      );
      setCart(updatedCart);
      setIsSaving(prev => ({ ...prev, [productId]: true }));
      setIsUpdating(true);
      const updatedProducts = updatedCart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        alternativeLocationId: item.alternativeLocationId || '',
        comment: item.comment || '',
        photoUrl: item.photoUrl || '',
        promotedPrice: item.promotedPrice !== null ? item.promotedPrice : null,
      }));
      console.log('Corps envoyé à updateOrder:', { orderId, orderData: { products: updatedProducts } });
      await updateOrder(orderId, { products: updatedProducts });
      await debouncedFetchCart();
    } catch (err) {
      console.error('Erreur dans updateComment:', err.message);
      setTempComments(prev => ({ ...prev, [productId]: '' }));
      Alert.alert('Erreur', 'Impossible de mettre à jour le commentaire : ' + err.message);
      await loadCartData();
    } finally {
      setIsSaving(prev => ({ ...prev, [productId]: false }));
      setIsUpdating(false);
    }
  };

  const handleRedeemPoints = async () => {
    if (!orderId || !Number.isInteger(pointsToUse) || pointsToUse <= 0 || pointsToUse > loyaltyPoints || cart.length === 0) {
      Alert.alert('Erreur', 'Veuillez entrer un nombre valide de points et vérifier que votre panier n\'est pas vide.');
      return;
    }
    try {
      setIsUpdating(true);
      console.log('Application des points:', { pointsToUse, orderId, availablePoints: loyaltyPoints, cartLength: cart.length });
      const result = await applyLoyaltyPoints(pointsToUse, orderId);
      console.log('Réponse de applyLoyaltyPoints:', JSON.stringify(result, null, 2));
      if (result.success) {
        const cartResponse = await fetchCart();
        console.log('Réponse fetchCart après applyLoyaltyPoints:', JSON.stringify(cartResponse, null, 2));
        setPointsToUse(0);
        Alert.alert('Succès', `${pointsToUse} point(s) utilisé(s) pour une réduction de ${pointsToUse * 50} FCFA.`);
      } else {
        throw new Error(result.message || 'Échec de l\'application des points');
      }
    } catch (err) {
      console.error('Erreur dans handleRedeemPoints:', err.message);
      let errorMessage = err.message || 'Erreur lors de l\'utilisation des points';
      if (err.message.includes('mongoose is not defined')) {
        errorMessage = 'Erreur serveur : problème de configuration de la base de données. Veuillez réessayer plus tard.';
        // Tentative de récupération des points via /loyalty/me
        try {
          const loyaltyResponse = await getUserLoyalty();
          setLoyaltyPoints(loyaltyResponse.points);
          console.log('Points récupérés après erreur:', loyaltyResponse.points);
        } catch (loyaltyErr) {
          console.error('Erreur lors de la récupération des points:', loyaltyErr.message);
        }
      }
      Alert.alert('Erreur', errorMessage);
      const cartResponse = await fetchCart();
      console.log('Réponse fetchCart après erreur:', JSON.stringify(cartResponse, null, 2));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProceedToDelivery = async () => {
    try {
      navigation.navigate('DeliveryAddressScreen', { orderId });
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de passer à l\'étape suivante : ' + err.message);
    }
  };

  const renderCartItem = ({ item }) => {
    const imageUrl = item.imageUrl || null;
    const isPromoted =
      item.promotedPrice !== null &&
      !isNaN(item.promotedPrice) &&
      item.promotedPrice < (item.price || Infinity);
    const displayPrice = isPromoted ? item.promotedPrice : item.price || 0;

    return (
      <View style={styles.cartItem}>
        <View style={styles.itemImageContainer}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.itemImage}
              resizeMode="contain"
              onError={(e) => console.log('Erreur image:', e.nativeEvent.error)}
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>Image à venir</Text>
            </View>
          )}
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.priceContainer}>
            {isPromoted ? (
              <>
                <Text style={styles.promotedPrice}>{(displayPrice * item.quantity).toFixed(2)} FCFA</Text>
                <Text style={styles.originalPrice}>{(item.price * item.quantity).toFixed(2)} FCFA</Text>
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>Promo</Text>
                </View>
              </>
            ) : (
              <Text style={styles.itemPrice}>{(displayPrice * item.quantity).toFixed(2)} FCFA</Text>
            )}
          </View>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              onPress={() => updateQuantity(item.productId, item.quantity - 1)}
              style={styles.quantityButton}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              onPress={() => updateQuantity(item.productId, item.quantity + 1)}
              style={styles.quantityButton}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
            {isSaving[item.productId] && (
              <Ionicons name="checkmark-circle-outline" size={20} color="#28a745" style={styles.savingIcon} />
            )}
          </View>
          <View style={styles.commentContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Ajouter un commentaire..."
              placeholderTextColor="#A1A1AA"
              value={tempComments[item.productId] || item.comment || ''}
              onChangeText={text => setTempComments(prev => ({ ...prev, [item.productId]: text }))}
              maxLength={100}
            />
            <TouchableOpacity
              onPress={() => updateComment(item.productId, tempComments[item.productId] || '')}
              style={styles.saveButton}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#28a745" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => removeFromCart(item.productId)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={20} color="#ff4d4f" />
          </TouchableOpacity>
        </View>
        {isUpdating && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
      </View>
    );
  };

  const renderSummary = () => {
    const baseSubtotal = cart.reduce((total, item) => {
      const price = item.promotedPrice !== null && !isNaN(item.promotedPrice) ? item.promotedPrice : item.price || 0;
      return total + price * (item.quantity || 1);
    }, 0);
    console.log('Résumé de la commande:', {
      baseSubtotal,
      loyaltyReductionAmount,
      loyaltyPointsUsed,
      total: calculateSubtotal(),
    });
    return (
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Sous-total produits :</Text>
          <Text style={styles.summaryValue}>{baseSubtotal.toFixed(2)} FCFA</Text>
        </View>
        {loyaltyPointsUsed > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>Réduction (points de fidélité) :</Text>
            <Text style={styles.summaryValue}>-{loyaltyReductionAmount.toFixed(2)} FCFA ({loyaltyPointsUsed} points)</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Total :</Text>
          <Text style={styles.summaryValue}>{calculateSubtotal().toFixed(2)} FCFA</Text>
        </View>
        <View style={styles.loyaltyContainer}>
          <Text style={styles.loyaltyText}>Points disponibles : {loyaltyPoints}</Text>
          <TextInput
            style={styles.pointsInput}
            placeholder="Points à utiliser"
            placeholderTextColor="#A1A1AA"
            value={pointsToUse ? pointsToUse.toString() : ''}
            onChangeText={text => {
              const value = text.replace(/[^0-9]/g, '');
              setPointsToUse(value ? parseInt(value) : 0);
            }}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={[styles.loyaltyButton, {
              opacity: (!Number.isInteger(pointsToUse) || pointsToUse <= 0 || pointsToUse > loyaltyPoints || cart.length === 0) ? 0.5 : 1
            }]}
            onPress={handleRedeemPoints}
            disabled={!Number.isInteger(pointsToUse) || pointsToUse <= 0 || pointsToUse > loyaltyPoints || cart.length === 0}
          >
            <Text style={styles.loyaltyButtonText}>Utiliser</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, { opacity: cart.length === 0 ? 0.5 : 1 }]}
          onPress={handleProceedToDelivery}
          disabled={cart.length === 0}
        >
          <Text style={styles.checkoutButtonText}>Choisir une adresse de livraison</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loadingCart) {
    return (
      <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadCartData}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Mon Panier</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <ProgressBar currentStep={1} />
        {cart.length === 0 ? (
          <Text style={styles.emptyText}>Votre panier est vide</Text>
        ) : (
          <FlatList
            data={cart}
            renderItem={renderCartItem}
            keyExtractor={item => item.productId}
            style={styles.list}
            ListFooterComponent={renderSummary}
            ListFooterComponentStyle={styles.footer}
          />
        )}
        {isUpdating && (
          <View style={styles.globalLoadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 20, paddingTop: 50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: { padding: 10 },
  headerText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: { width: 44 },
  progressBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: -25,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    elevation: 2,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  progressCircleActive: {
    backgroundColor: '#28a745',
  },
  progressCircleInactive: {
    backgroundColor: '#ddd',
  },
  progressText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressTextActive: {
    color: '#fff',
  },
  progressTextInactive: {
    color: '#666',
  },
  progressLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  progressLabelActive: {
    color: '#28a745',
    fontWeight: 'bold',
  },
  progressLabelInactive: {
    color: '#666',
  },
  list: { flex: 1 },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  placeholderText: { color: '#666', fontSize: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  itemPrice: { fontSize: 14, color: '#666' },
  promotedPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  promoBadge: {
    backgroundColor: '#28a745',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  promoBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  quantityButton: {
    backgroundColor: '#28a745',
    padding: 5,
    borderRadius: 5,
    width: 30,
    alignItems: 'center',
  },
  quantityButtonText: { color: '#fff', fontSize: 16 },
  quantityText: { marginHorizontal: 10, fontSize: 16, color: '#333' },
  savingIcon: {
    marginLeft: 10,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
    flex: 1,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
    placeholderTextColor: '#A1A1AA',
  },
  saveButton: {
    marginLeft: 8,
    padding: 5,
  },
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    elevation: 2,
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 16,
    color: '#333',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  loyaltyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    elevation: 2,
    justifyContent: 'flex-start',
  },
  loyaltyText: {
    fontSize: 16,
    color: '#333',
    marginRight: 8,
    minWidth: 90,
    textAlign: 'left',
  },
  pointsInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    fontSize: 14,
    width: 70,
    marginRight: 8,
    backgroundColor: '#f9f9f9',
    textAlign: 'left',
  },
  loyaltyButton: {
    backgroundColor: '#28a745',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 0,
  },
  loyaltyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  checkoutButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#fff', marginTop: 10 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#ff4d4f', textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#28a745', padding: 12, borderRadius: 10, alignItems: 'center' },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { paddingBottom: 20 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  globalLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});