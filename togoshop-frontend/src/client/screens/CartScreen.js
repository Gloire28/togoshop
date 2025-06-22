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
import { AppContext } from '../../shared/context/AppContext';
import { updateOrder, getUserLoyalty, redeemPoints } from '../../shared/services/api';
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
  const { cart, setCart, fetchCart, loadingCart, error, user } = useContext(AppContext);
  const [orderId, setOrderId] = useState(null);
  const [tempComments, setTempComments] = useState({});
  const [isSaving, setIsSaving] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  // const [promoCode, setPromoCode] = useState(''); // Commenté pour désactiver la fonctionnalité promo
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [usedPoints, setUsedPoints] = useState(0);
  // const [promoApplied, setPromoApplied] = useState(null); // Commenté pour désactiver la fonctionnalité promo

  useEffect(() => {
    loadCartData();
    fetchLoyaltyPoints();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('CartScreen est actif, rafraîchissement du panier');
      loadCartData();
      fetchLoyaltyPoints();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCartData = async () => {
    try {
      const cartResponse = await fetchCart();
      console.log('Réponse loadCartData:', JSON.stringify(cartResponse, null, 2));
      if (cartResponse && cartResponse.orderId) {
        setOrderId(cartResponse.orderId);
        console.log('Cart mis à jour dans loadCartData:', JSON.stringify(cartResponse.cart, null, 2));
        setCart(cartResponse.cart || []);
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

  const fetchLoyaltyPoints = async () => {
    if (user) {
      try {
        const data = await getUserLoyalty();
        setLoyaltyPoints(data.points || 0);
      } catch (err) {
        console.log('Erreur lors de la récupération des points de fidélité:', err.message);
        Alert.alert('Erreur', 'Impossible de charger les points de fidélité');
      }
    }
  };

  const calculateSubtotal = useCallback(() => {
    const baseTotal = cart.reduce((total, item) => {
      const price = item.promotedPrice !== null && !isNaN(item.promotedPrice) ? item.promotedPrice : item.price || 0;
      return total + price * (item.quantity || 1);
    }, 0);
    // const promoDiscount = promoApplied // Commenté pour désactiver la réduction promo
    //   ? promoApplied.discountType === 'percentage'
    //     ? (baseTotal * promoApplied.discountValue) / 100
    //     : promoApplied.discountValue
    //   : 0;
    const pointsDiscount = usedPoints * 10; // 10 FCFA par point
    return Math.max(0, baseTotal - pointsDiscount);
  }, [cart, usedPoints]);

  const debouncedFetchCart = debounce(async () => {
    try {
      setIsUpdating(true);
      console.log('Déclenchement de debouncedFetchCart');
      await fetchCart();
    } catch (err) {
      console.log('Erreur lors du rafraîchissement du panier:', err.message);
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
      debouncedFetchCart();
    } catch (err) {
      console.log('Erreur dans updateQuantity:', err.message);
      Alert.alert('Erreur', 'Impossible de mettre à jour la quantité : ' + err.message);
      await fetchCart();
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
            }));
            console.log('Corps envoyé à updateOrder:', { orderId, orderData: { products: updatedProducts } });
            await updateOrder(orderId, { products: updatedProducts });
            debouncedFetchCart();
          } catch (err) {
            console.log('Erreur dans removeFromCart:', err.message);
            Alert.alert('Erreur', 'Impossible de supprimer le produit : ' + err.message);
            await fetchCart();
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
      await updateOrder(orderId, { products: updatedProducts });
      debouncedFetchCart();
    } catch (err) {
      console.log('Erreur dans updateComment:', err.message);
      setTempComments(prev => ({ ...prev, [productId]: '' }));
      Alert.alert('Erreur', 'Impossible de mettre à jour le commentaire : ' + err.message);
      await fetchCart();
    } finally {
      setIsSaving(prev => ({ ...prev, [productId]: false }));
      setIsUpdating(false);
    }
  };

  // const handleApplyPromo = async () => {
  //   if (!orderId || !promoCode) {
  //     Alert.alert('Erreur', 'Veuillez entrer un code promo et avoir un panier valide.');
  //     return;
  //   }
  //   try {
  //     const response = await applyPromotion(promoCode, orderId);
  //     setPromoApplied(response.promotion);
  //     Alert.alert(
  //       'Succès',
  //       `Promotion ${promoCode} appliquée avec succès ! Réduction de ${response.promotion.discountValue}${
  //         response.promotion.discountType === 'percentage' ? '%' : ' FCFA'
  //       }`
  //     );
  //     setPromoCode('');
  //     await fetchCart();
  //   } catch (err) {
  //     console.log('Erreur dans handleApplyPromo:', err.message);
  //     Alert.alert('Erreur', err.message || 'Code promo invalide ou erreur d\'application');
  //   }
  // };

  const handleRedeemPoints = async () => {
    if (!orderId || usedPoints <= 0 || usedPoints > loyaltyPoints) {
      Alert.alert('Erreur', 'Vérifiez vos points disponibles et entrez une valeur valide.');
      return;
    }
    try {
      await redeemPoints(usedPoints, orderId);
      setLoyaltyPoints(prev => prev - usedPoints);
      setUsedPoints(0);
      Alert.alert('Succès', `${usedPoints} points utilisés avec succès !`);
      await fetchCart();
    } catch (err) {
      console.log('Erreur dans handleRedeemPoints:', err.message);
      Alert.alert('Erreur', err.message || 'Erreur lors de l\'utilisation des points');
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
    const imageSource = imageMap[item.productId] || null;
    const isPromoted =
      item.promotedPrice !== null &&
      !isNaN(item.promotedPrice) &&
      item.promotedPrice < (item.price || Infinity);
    const displayPrice = isPromoted ? item.promotedPrice : item.price || 0;

    return (
      <View style={styles.cartItem}>
        <View style={styles.itemImageContainer}>
          {imageSource ? (
            <Image source={imageSource} style={styles.itemImage} resizeMode="contain" />
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
                <Text style={styles.promotedPrice}>{(displayPrice * item.quantity).toFixed(0)} FCFA</Text>
                <Text style={styles.originalPrice}>{(item.price * item.quantity).toFixed(0)} FCFA</Text>
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>Promo</Text>
                </View>
              </>
            ) : (
              <Text style={styles.itemPrice}>{(displayPrice * item.quantity).toFixed(0)} FCFA</Text>
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
            <ActivityIndicator size="large" color="#28a745" />
          </View>
        )}
      </View>
    );
  };

  const renderSummary = () => {
    return (
      <View style={styles.summaryContainer}>
        {/* Commenté pour désactiver la fonctionnalité de code promo */}
        {/* <View style={styles.promoContainer}>
          <TextInput
            style={styles.promoInput}
            placeholder="Entrez un code promo"
            value={promoCode}
            onChangeText={setPromoCode}
          />
          <TouchableOpacity style={styles.promoButton} onPress={handleApplyPromo}>
            <Text style={styles.promoButtonText}>Appliquer</Text>
          </TouchableOpacity>
        </View> */}
        <View style={styles.loyaltyContainer}>
          <Text style={styles.loyaltyText}>Points disponibles : {loyaltyPoints}</Text>
          <TextInput
            style={styles.pointsInput}
            placeholder="Points à utiliser"
            value={usedPoints ? usedPoints.toString() : ''}
            onChangeText={text => setUsedPoints(parseInt(text) || 0)}
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.loyaltyButton} onPress={handleRedeemPoints}>
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchCart}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ProgressBar currentStep={1} />
        <Text style={styles.headerText}>Sous-total : {calculateSubtotal().toFixed(0)} FCFA</Text>
      </View>
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
          <ActivityIndicator size="large" color="#28a745" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#fff',
    padding: 10,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    elevation: 2,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginTop: 10,
  },
  progressBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  list: { flex: 1, padding: 10 },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    position: 'relative',
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itemImage: { width: '100%', height: '100%' },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#007bff',
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
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    fontSize: 14,
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
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    elevation: 2,
  },
  promoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    fontSize: 14,
    marginRight: 10,
  },
  promoButton: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  promoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loyaltyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  loyaltyText: {
    fontSize: 14,
    color: '#333',
    marginRight: 10,
  },
  pointsInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    fontSize: 14,
    width: 100,
    marginRight: 10,
  },
  loyaltyButton: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  loyaltyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 18, color: '#666' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#ff4d4f', textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#007bff', padding: 12, borderRadius: 8 },
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