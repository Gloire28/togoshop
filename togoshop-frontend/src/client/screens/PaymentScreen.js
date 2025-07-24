import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, getSupermarket } from '../../shared/services/api';
import { AppContext } from '../../shared/context/AppContext';

const ProgressBar = ({ currentStep }) => {
  const steps = [
    { label: 'Panier', step: 1 },
    { label: 'Livraison', step: 2 },
    { label: 'Paiement', step: 3 },
    { label: 'Confirmation', step: 4 },
  ];

  return (
    <View style={styles.progressBarContainer}>
      {steps.map((stepItem, index) => (
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
          {index < steps.length - 1 && (
            <View
              style={[
                styles.connector,
                currentStep > stepItem.step ? styles.connectorActive : styles.connectorInactive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
};

export default function PaymentScreen({ route, navigation }) {
  const { orderId, deliveryAddress } = route.params || {};
  const { cart, fetchCart, loyaltyPointsUsed, loyaltyReductionAmount } = useContext(AppContext);
  const [order, setOrder] = useState(null);
  const [supermarketLocation, setSupermarketLocation] = useState({ lat: 0, lng: 0 });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [deliveryType, setDeliveryType] = useState('standard');
  const [clientPhone, setClientPhone] = useState('');

  useEffect(() => {
    if (!orderId) {
      console.log('Erreur: orderId manquant dans route.params');
      Alert.alert('Erreur', 'Aucun ID de commande trouvé. Redirection...', [
        { text: 'OK', onPress: () => navigation.navigate('Home') }
      ]);
      return;
    }

    const fetchOrderAndSupermarket = async () => {
      try {
        // Synchroniser avec AppContext
        const cartResponse = await fetchCart();
        console.log('Réponse fetchCart dans PaymentScreen:', JSON.stringify(cartResponse, null, 2));

        // Récupérer les détails de la commande
        const orderResponse = await apiRequest(`/orders/${orderId}`);
        console.log('Réponse complète de /orders/:id:', JSON.stringify(orderResponse, null, 2));
        if (!orderResponse.order) {
          throw new Error('Commande non trouvée dans la réponse');
        }

        // Normaliser les produits
        const normalizedOrder = {
          ...orderResponse.order,
          products: orderResponse.order.products.map(item => ({
            productId: item.productId?._id || item.productId,
            name: item.productId?.name || item.name || 'Produit inconnu',
            price: Number(item.productId?.price || item.price || 0),
            promotedPrice: item.promotedPrice !== null && !isNaN(item.promotedPrice) ? Number(item.promotedPrice) : null,
            quantity: Number(item.quantity || 1),
            comment: item.comment || '',
            alternativeLocationId: item.alternativeLocationId || '',
            stockByLocation: item.stockByLocation || item.productId?.stockByLocation || [],
            weight: Number(item.weight || item.productId?.weight || 0),
          })),
        };

        setOrder(normalizedOrder);
        console.log('Order normalisé après setOrder:', JSON.stringify(normalizedOrder, null, 2));

        // Récupérer l'emplacement du supermarché
        const supermarketId = normalizedOrder.supermarketId?._id || normalizedOrder.supermarketId;
        const locationId = normalizedOrder.locationId;
        if (!supermarketId || !locationId) {
          throw new Error('ID du supermarché ou de l’emplacement manquant');
        }

        const supermarket = await getSupermarket(supermarketId);
        const location = supermarket.locations.find(loc => loc._id === locationId);
        if (location) {
          setSupermarketLocation({ lat: location.latitude, lng: location.longitude });
          console.log('Emplacement supermarché:', { lat: location.latitude, lng: location.longitude });
        } else {
          console.warn('Emplacement du supermarché non trouvé');
          Alert.alert('Erreur', 'Emplacement du supermarché non trouvé.');
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des données:', error.message);
        Alert.alert('Erreur', 'Impossible de récupérer les détails de la commande ou du supermarché.');
      }
    };

    fetchOrderAndSupermarket();
  }, [orderId, fetchCart]);

  // Calculer le sous-total et le total à partir des produits
  const calculateSubtotal = () => {
    if (!order?.products) return 0;
    const subtotal = order.products.reduce((total, item) => {
      const price = item.promotedPrice !== null ? item.promotedPrice : item.price || 0;
      return total + price * (item.quantity || 1);
    }, 0);
    return Number(subtotal.toFixed(0));
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const total = Math.max(0, subtotal - (order?.loyaltyReductionAmount || 0));
    return Number(total.toFixed(0));
  };

  const handlePayment = async () => {
    console.log('Mode de paiement sélectionné:', paymentMethod);
    if (!paymentMethod || paymentMethod !== 'cash') {
      Alert.alert('Erreur', 'Seul le paiement en espèces est disponible pour le moment.');
      return;
    }

    if (['Flooz', 'TMoney'].includes(paymentMethod) && !clientPhone) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone pour Flooz/TMoney.');
      return;
    }

    try {
      const submitData = {
        paymentMethod,
        deliveryType,
        clientPhone: clientPhone || undefined,
        loyaltyPoints: order?.loyaltyPointsUsed || 0, // Inclure pour cohérence avec submitOrder
      };
      console.log('Envoi de submitOrder:', { orderId, submitData });
      const response = await apiRequest(`/orders/${orderId}/submit`, {
        method: 'PUT',
        body: submitData,
      });
      console.log('Réponse de submitOrder:', JSON.stringify(response, null, 2));
      const orderNumber = response.orderNumber;
      setOrder(prevOrder => ({
        ...prevOrder,
        ...response.order,
        status: response.order.status,
      }));
      await AsyncStorage.setItem('cart', JSON.stringify([]));
      Alert.alert(
        'Commande Soumise',
        `Numéro de commande : ${orderNumber}\nMéthode : ${paymentMethod}\nLivraison : ${deliveryType}\nTotal : ${calculateTotal()} FCFA\nStatut : ${response.order.status}`,
        [{ text: 'OK', onPress: () => navigation.navigate('Tracking', { orderId }) }]
      );
    } catch (error) {
      console.error('Erreur lors de la soumission de la commande:', error.message);
      Alert.alert('Erreur', `Impossible de soumettre la commande: ${error.message}`);
    }
  };

  if (!order) {
    return (
      <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
        <View style={styles.container}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </LinearGradient>
    );
  }

  const subtotal = calculateSubtotal();
  const total = calculateTotal();
  console.log('Récapitulatif calculé:', {
    subtotal,
    loyaltyPointsUsed: order?.loyaltyPointsUsed || 0,
    loyaltyReductionAmount: order?.loyaltyReductionAmount || 0,
    total,
  });

  return (
    <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <ProgressBar currentStep={3} />
          </View>
          <View style={styles.content}>
            <Text style={styles.title}>Récapitulatif de Votre Commande</Text>

            <View style={styles.receiptTable}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderText}>Nom</Text>
                <Text style={styles.tableHeaderText}>Prix (FCFA)</Text>
                <Text style={styles.tableHeaderText}>Qté</Text>
                <Text style={styles.tableHeaderText}>Total (FCFA)</Text>
              </View>
              {order?.products?.length > 0 ? (
                <>
                  {order.products.map((item, index) => (
                    <View key={index} style={styles.tableRow}>
                      <Text style={styles.tableCell}>{item.name || 'Produit inconnu'}</Text>
                      <Text style={styles.tableCell}>
                        {(item.promotedPrice !== null ? item.promotedPrice : item.price || 0).toFixed(0)}
                      </Text>
                      <Text style={styles.tableCell}>{item.quantity || 0}</Text>
                      <Text style={styles.tableCell}>
                        {((item.promotedPrice !== null ? item.promotedPrice : item.price || 0) * (item.quantity || 0)).toFixed(0)}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.thankYouMessage]}>
                      Merci d'avoir choisi nos services ! 🛒
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>Aucun produit dans cette commande</Text>
                </View>
              )}
            </View>

            <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sous-total :</Text>
                <Text style={styles.summaryValue}>{subtotal.toFixed(0)} FCFA</Text>
              </View>
              {(order?.loyaltyPointsUsed || 0) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Réduction:</Text>
                  <Text style={styles.summaryValue}>
                    -{(order?.loyaltyReductionAmount || 0).toFixed(0)} FCFA ({order?.loyaltyPointsUsed || 0})
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelTotal}>Montant Total :</Text>
                <Text style={styles.summaryValueTotal}>{total.toFixed(0)} FCFA</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Choisir un Mode de Paiement</Text>
            <View style={styles.cardContainer}>
              {[
                { value: 'Flooz', label: 'Flooz', disabled: true },
                { value: 'TMoney', label: 'TMoney', disabled: true },
                { value: 'wallet', label: 'Wallet', disabled: true },
                { value: 'cash', label: 'Espèces', disabled: false },
              ].map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.paymentCard,
                    paymentMethod === method.value && styles.selectedCard,
                    method.disabled && styles.disabledCard,
                  ]}
                  onPress={() => {
                    if (!method.disabled) {
                      setPaymentMethod(method.value);
                      console.log('Méthode sélectionnée:', method.value);
                    }
                  }}
                  disabled={method.disabled}
                >
                  <Text style={[styles.cardText, method.disabled && styles.disabledText]}>
                    {method.label}
                    {method.disabled && ' (Non disponible)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {['Flooz', 'TMoney'].includes(paymentMethod) && (
              <View style={styles.phoneInputContainer}>
                <Text style={styles.sectionTitle}>Numéro de Téléphone</Text>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Entrez votre numéro (ex: 12345678)"
                  keyboardType="numeric"
                  value={clientPhone}
                  onChangeText={setClientPhone}
                />
              </View>
            )}

            <Text style={styles.sectionTitle}>Choisir un Mode de Livraison</Text>
            <View style={styles.cardContainer}>
              {['Evening', 'Standard', 'Retrait'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.deliveryCard, deliveryType === type.toLowerCase() && styles.selectedCard]}
                  onPress={() => {
                    setDeliveryType(type.toLowerCase());
                    console.log('Type de livraison sélectionné:', type.toLowerCase());
                  }}
                >
                  <Text style={styles.cardText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.backButtonStyle} onPress={() => navigation.navigate('CartMain')}>
                <Text style={styles.buttonText}>Retour au Panier</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handlePayment}>
                <Text style={styles.buttonText}>Envoyer au Supermarché</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scrollView: { flex: 1 },
  container: { flex: 1 },
  header: {
    marginTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    elevation: 2,
    borderRadius: 16,
  },
  backButton: { marginRight: 10 },
  progressBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 1,
    marginBottom: 5,
    elevation: 2,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
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
  connector: {
    position: 'absolute',
    top: 11,
    left: '50%',
    width: '100%',
    height: 2,
    zIndex: -1,
  },
  connectorActive: {
    backgroundColor: '#28a745',
  },
  connectorInactive: {
    backgroundColor: '#ddd',
  },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#2c3e50' },
  receiptTable: {
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#3498db',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  tableHeaderText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableCell: { fontSize: 14, color: '#333', flex: 1, textAlign: 'center' },
  thankYouMessage: {
    fontStyle: 'italic',
    color: '#28a745',
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 10,
    fontSize: 16,
  },
  summarySection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 2,
    padding: 15,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: { fontSize: 16, color: '#666' },
  summaryValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  summaryLabelTotal: { fontSize: 18, color: '#666', fontWeight: 'bold' },
  summaryValueTotal: { fontSize: 18, fontWeight: 'bold', color: '#e74c3c' },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#2c3e50', marginBottom: 10 },
  cardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  paymentCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
    elevation: 2,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  deliveryCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    width: '31%',
    alignItems: 'center',
    elevation: 2,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedCard: {
    backgroundColor: '#d1e7dd',
    borderColor: '#2ecc71',
  },
  disabledCard: {
    backgroundColor: '#f0f0f0',
    opacity: 0.6,
    borderColor: '#ccc',
  },
  disabledText: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  cardText: { fontSize: 16, fontWeight: '500', color: '#333' },
  phoneInputContainer: { marginBottom: 20 },
  phoneInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  backButtonStyle: {
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loadingText: { fontSize: 16, color: '#fff', textAlign: 'center' },
});