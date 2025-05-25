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
import { AppContext } from '../../context/AppContext';
import { updateOrder } from '../services/api';
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
  const { cart, setCart, fetchCart, loadingCart, error } = useContext(AppContext);
  const [orderId, setOrderId] = useState(null);
  const [tempComments, setTempComments] = useState({});
  const [isSaving, setIsSaving] = useState({});
  const [isUpdating, setIsUpdating] = useState(false); // Nouvel état pour les mises à jour

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
      console.log('Réponse loadCartData:', JSON.stringify(cartResponse));
      if (cartResponse && cartResponse.orderId) {
        setOrderId(cartResponse.orderId);
        console.log('orderId défini:', cartResponse.orderId);
      } else {
        setOrderId(null);
        console.log('Aucun orderId valide trouvé, défini à null');
      }
    } catch (err) {
      console.log('Erreur lors du chargement des données dans loadCartData:', err.message);
      setOrderId(null);
    }
  };

  const calculateSubtotal = useCallback(() => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [cart]);

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
    console.log('Vérification de setCart dans updateQuantity:', !!setCart);
    if (newQuantity < 1 || !orderId) return;

    try {
      const updatedCart = cart.map(item =>
        item.productId === productId ? { ...item, quantity: newQuantity } : item
      );
      setCart(updatedCart);

      setIsSaving(prev => ({ ...prev, [productId]: true }));
      setIsUpdating(true); // Active le chargement local
      const updatedProducts = updatedCart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        comment: item.comment || '',
        alternativeLocationId: item.alternativeLocationId || '',
      }));
      console.log('Préparation de updateOrder pour quantité - updatedProducts:', updatedProducts);
      console.log('Appel à updateOrder pour quantité:', { orderId, products: updatedProducts });
      await updateOrder(orderId, { products: updatedProducts });
      console.log('updateOrder réussi pour quantité - Réponse attendue:', 'Vérifier si la réponse contient des données');
      console.log('Préparation de debouncedFetchCart après update');
      debouncedFetchCart();
      console.log('debouncedFetchCart appelé, attente de 1s avant exécution');
    } catch (err) {
      console.log('Erreur capturée dans updateQuantity avant affichage:', err);
      console.log('Erreur dans updateQuantity:', err.message);
      Alert.alert('Erreur', 'Impossible de mettre à jour la quantité : ' + err.message);
      console.log('Appel à fetchCart après erreur pour récupération');
      await fetchCart();
      console.log('fetchCart appelé après erreur, état devrait être rechargé');
    } finally {
      setIsSaving(prev => ({ ...prev, [productId]: false }));
      setIsUpdating(false); // Désactive le chargement local
    }
  };

  const removeFromCart = async (productId) => {
    if (!orderId) return;

    Alert.alert(
      'Confirmer la suppression',
      'Voulez-vous supprimer ce produit du panier ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedCart = cart.filter(item => item.productId !== productId);
              setCart(updatedCart);

              setIsUpdating(true); // Active le chargement local
              const updatedProducts = updatedCart.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                comment: item.comment || '',
                alternativeLocationId: item.alternativeLocationId || '',
              }));
              console.log('Préparation de updateOrder pour suppression - updatedProducts:', updatedProducts);
              console.log('Appel à updateOrder pour suppression:', { orderId, products: updatedProducts });
              await updateOrder(orderId, { products: updatedProducts });
              console.log('updateOrder réussi pour suppression - Réponse attendue:', 'Vérifier si la réponse contient des données');
              console.log('Préparation de debouncedFetchCart après suppression');
              debouncedFetchCart();
              console.log('debouncedFetchCart appelé, attente de 1s avant exécution');
            } catch (err) {
              console.log('Erreur capturée dans removeFromCart avant affichage:', err);
              console.log('Erreur dans removeFromCart:', err.message);
              Alert.alert('Erreur', 'Impossible de supprimer le produit : ' + err.message);
              console.log('Appel à fetchCart après erreur pour récupération');
              await fetchCart();
              console.log('fetchCart appelé après erreur, état devrait être rechargé');
            } finally {
              setIsUpdating(false); // Désactive le chargement local
            }
          },
        },
      ]
    );
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
      setIsUpdating(true); // Active le chargement local
      const updatedProducts = updatedCart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        alternativeLocationId: item.alternativeLocationId || '',
        comment: item.comment || '',
        photoUrl: item.photoUrl || '',
      }));
      console.log('Préparation de updateOrder pour commentaire - updatedProducts:', updatedProducts);
      console.log('Appel à updateOrder pour commentaire:', { orderId, products: updatedProducts });
      await updateOrder(orderId, { products: updatedProducts });
      console.log('updateOrder réussi pour commentaire - Réponse attendue:', 'Vérifier si la réponse contient des données');
      console.log('Préparation de debouncedFetchCart après commentaire');
      debouncedFetchCart();
      console.log('debouncedFetchCart appelé, attente de 1s avant exécution');
    } catch (err) {
      console.log('Erreur capturée dans updateComment avant affichage:', err);
      console.log('Erreur dans updateComment:', err.message);
      setTempComments(prev => ({ ...prev, [productId]: '' }));
      Alert.alert('Erreur', 'Impossible de mettre à jour le commentaire : ' + err.message);
      console.log('Appel à fetchCart après erreur pour récupération');
      await fetchCart();
      console.log('fetchCart appelé après erreur, état devrait être rechargé');
    } finally {
      setIsSaving(prev => ({ ...prev, [productId]: false }));
      setIsUpdating(false); // Désactive le chargement local
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
    console.log('Rendu de l\'item:', item);
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
          <Text style={styles.itemPrice}>{item.price * item.quantity} FCFA</Text>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              onPress={() => {
                console.log('Clic sur "-" pour productId:', item.productId, 'Quantité actuelle:', item.quantity);
                updateQuantity(item.productId, item.quantity - 1);
              }}
              style={styles.quantityButton}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              onPress={() => {
                console.log('Clic sur "+" pour productId:', item.productId, 'Quantité actuelle:', item.quantity);
                updateQuantity(item.productId, item.quantity + 1);
              }}
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
              onChangeText={(text) => setTempComments({ ...tempComments, [item.productId]: text })}
              maxLength={100}
            />
            <TouchableOpacity
              onPress={() => {
                console.log('Clic sur sauvegarde commentaire pour productId:', item.productId, 'Commentaire:', tempComments[item.productId] || '');
                updateComment(item.productId, tempComments[item.productId] || '');
              }}
              style={styles.saveButton}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#28a745" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => {
              console.log('Clic sur suppression pour productId:', item.productId);
              removeFromCart(item.productId);
            }}
            style={styles.deleteButton}
          >
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
        <Text style={styles.headerText}>Sous-total : {calculateSubtotal()} FCFA</Text>
      </View>
      {cart.length === 0 ? (
        <Text style={styles.emptyText}>Votre panier est vide</Text>
      ) : (
        <FlatList
          data={cart}
          renderItem={renderCartItem}
          keyExtractor={(item) => item.productId}
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
  itemPrice: { fontSize: 14, color: '#666', marginTop: 5 },
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