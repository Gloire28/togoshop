import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, getSupermarket, updateOrderStatus } from '../services/api';

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

export default function PaymentScreen({ route, navigation }) {
  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [supermarketLocation, setSupermarketLocation] = useState({ lat: 0, lng: 0 });
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [deliveryType, setDeliveryType] = useState('standard');

  // Récupérer les données de la commande et du supermarché
  useEffect(() => {
    const fetchOrderAndSupermarket = async () => {
      try {
        const orderResponse = await apiRequest(`/orders/${orderId}`);
        setOrder(orderResponse);

        const supermarketId = orderResponse.supermarketId._id;
        const supermarket = await getSupermarket(supermarketId);
        const location = supermarket.locations.find(loc => loc._id === orderResponse.locationId);
        if (location) {
          setSupermarketLocation({ lat: location.latitude, lng: location.longitude });
        } else {
          Alert.alert('Erreur', 'Emplacement du supermarché non trouvé.');
        }
      } catch (error) {
        console.log('Erreur lors de la récupération des données:', error.message);
        Alert.alert('Erreur', 'Impossible de récupérer les détails de la commande ou du supermarché.');
      }
    };
    if (orderId) fetchOrderAndSupermarket();
  }, [orderId]);

  // Calculer la distance avec la formule haversine
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Rayon de la Terre en km
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  };

  // Calculer les frais de livraison
  const calculateDeliveryFee = () => {
    if (!order?.deliveryAddress || !supermarketLocation.lat || !supermarketLocation.lng) {
      return 500;
    }
    const distance = calculateDistance(
      order.deliveryAddress.lat,
      order.deliveryAddress.lng,
      supermarketLocation.lat,
      supermarketLocation.lng
    );
    const distanceFee = distance > 5 ? Math.round((distance - 5) * 100) : 0;
    const weightFee = 0;
    const baseFee = deliveryType === 'evening' ? 400 : 500;
    const totalFee = baseFee + distanceFee + weightFee;
    console.log(`Calcul frais: distance=${distance.toFixed(2)}km, distanceFee=${distanceFee}, baseFee=${baseFee}, total=${totalFee}`);
    return totalFee;
  };

  const subtotal = order ? order.totalAmount || 0 : 0;
  const deliveryFee = order?.deliveryFee || calculateDeliveryFee(); // Utiliser la valeur backend si disponible
  const serviceFee = Math.round(subtotal * 0.10);
  const totalAmount = subtotal + deliveryFee + serviceFee;

  // Mettre à jour le statut et confirmer le paiement
  const handlePayment = async () => {
    if (!paymentMethod) {
      Alert.alert('Erreur', 'Veuillez sélectionner un mode de paiement.');
      return;
    }

    try {
      const response = await apiRequest(`/orders/${orderId}/submit`, {
        method: 'PUT',
        body: { paymentMethod, deliveryType },
      });
      const orderNumber = `ORD-${Math.floor(Math.random() * 100000)}`;
      setOrder(prevOrder => ({
        ...prevOrder,
        deliveryFee: response.order.deliveryFee,
        status: response.order.status,
      }));
      await AsyncStorage.setItem('cart', JSON.stringify([]));
      Alert.alert(
        'Commande Soumise',
        `Numéro de commande : ${orderNumber}\nMéthode : ${paymentMethod}\nLivraison : ${deliveryType}\nTotal : ${totalAmount} FCFA\nStatut : ${response.order.status}`,
        [{ text: 'OK', onPress: () => navigation.navigate('Tracking') }]
      );
    } catch (error) {
      console.log('Erreur lors de la soumission de la commande:', error.message);
      Alert.alert('Erreur', 'Impossible de soumettre la commande.');
    }
  };

  if (!order) {
    return (
      <View style={styles.container}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <ProgressBar currentStep={3} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Récapitulatif de Votre Commande</Text>

        {/* Tableau du Récu */}
        <View style={styles.receiptTable}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Nom</Text>
            <Text style={styles.tableHeaderText}>Prix (FCFA)</Text>
            <Text style={styles.tableHeaderText}>Qté</Text>
            <Text style={styles.tableHeaderText}>Total (FCFA)</Text>
          </View>
          {order.products.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCell}>{item.productId.name}</Text>
              <Text style={styles.tableCell}>{item.productId.price}</Text>
              <Text style={styles.tableCell}>{item.quantity}</Text>
              <Text style={styles.tableCell}>{item.productId.price * item.quantity}</Text>
            </View>
          ))}
        </View>

        {/* Détails des Frais */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total :</Text>
            <Text style={styles.summaryValue}>{subtotal} FCFA</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frais de Livraison :</Text>
            <Text style={styles.summaryValue}>{Math.round(deliveryFee)} FCFA</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frais de Service (10%) :</Text>
            <Text style={styles.summaryValue}>{serviceFee} FCFA</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelTotal}>Montant Total :</Text>
            <Text style={styles.summaryValueTotal}>{Math.round(totalAmount)} FCFA</Text>
          </View>
        </View>

        {/* Cartes des Moyens de Paiement */}
        <Text style={styles.sectionTitle}>Choisir un Mode de Paiement</Text>
        <View style={styles.cardContainer}>
          {['Flooz', 'TMoney', 'Wallet', 'Espèces'].map((method) => (
            <TouchableOpacity
              key={method}
              style={[styles.paymentCard, paymentMethod === method && styles.selectedCard]}
              onPress={() => setPaymentMethod(method)}
            >
              <Text style={styles.cardText}>{method}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cartes des Modes de Livraison */}
        <Text style={styles.sectionTitle}>Choisir un Mode de Livraison</Text>
        <View style={styles.cardContainer}>
          {['Evening', 'Standard', 'Retrait'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.deliveryCard, deliveryType === type.toLowerCase() && styles.selectedCard]}
              onPress={() => setDeliveryType(type.toLowerCase())}
            >
              <Text style={styles.cardText}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Boutons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.backButtonStyle} onPress={() => navigation.navigate('CartMain')}>
            <Text style={styles.buttonText}>Retour au Panier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmButton} onPress={handlePayment}>
            <Text style={styles.buttonText}>Envoyer au Supermarché</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    elevation: 2,
  },
  backButton: { marginRight: 10 },
  progressBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
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
  tableCell: { fontSize: 14, color: '#333' },
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
  cardText: { fontSize: 16, fontWeight: '500', color: '#333' },
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
});