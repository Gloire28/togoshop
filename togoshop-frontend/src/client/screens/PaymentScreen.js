import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, getSupermarket, updateOrderStatus } from '../../shared/services/api';

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
  const [paymentMethod, setPaymentMethod] = useState('cash'); // Pré-sélectionne 'cash' par défaut
  const [deliveryType, setDeliveryType] = useState('standard');
  const [clientPhone, setClientPhone] = useState(''); // Ajout pour Flooz/TMoney

  useEffect(() => {
    const fetchOrderAndSupermarket = async () => {
      try {
        const orderResponse = await apiRequest(`/orders/${orderId}`);
        console.log('Réponse complète de /orders/:id :', orderResponse);
        if (!orderResponse.order) {
          throw new Error('Commande non trouvée dans la réponse');
        }
        setOrder(orderResponse.order);

        const supermarketId = orderResponse.order?.supermarketId?._id;
        const locationId = orderResponse.order?.locationId;

        if (!supermarketId) {
          throw new Error('ID du supermarché non trouvé dans la commande');
        }
        if (!locationId) {
          throw new Error('ID de l’emplacement non trouvé dans la commande');
        }

        const supermarket = await getSupermarket(supermarketId);
        const location = supermarket.locations.find(loc => loc._id === locationId);
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

  const subtotal = order?.subtotal || (order?.products?.reduce((sum, item) => sum + (item.productId?.price || 0) * item.quantity, 0) || 0);
  const deliveryFee = order?.deliveryFee || 0;
  const serviceFee = order?.serviceFee || 0;
  const totalAmount = order?.totalAmount || (subtotal + deliveryFee + serviceFee);
  console.log(`Valeurs calculées - Sous-total: ${subtotal}, Frais de livraison: ${deliveryFee}, Frais de service: ${serviceFee}, Total: ${totalAmount}`);

  const handlePayment = async () => {
    console.log('Mode de paiement sélectionné:', paymentMethod); // Log pour débogage
    if (!paymentMethod || paymentMethod !== 'cash') {
      Alert.alert('Erreur', 'Seul le paiement en espèces est disponible pour le moment.');
      return;
    }

    if (['Flooz', 'TMoney'].includes(paymentMethod) && !clientPhone) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone pour Flooz/TMoney.');
      return;
    }

    try {
      const response = await apiRequest(`/orders/${orderId}/submit`, {
        method: 'PUT',
        body: { paymentMethod, deliveryType, clientPhone },
      });
      const orderNumber = response.orderNumber;
      setOrder(prevOrder => ({
        ...prevOrder,
        ...response.order,
        deliveryFee: response.order.deliveryFee,
        status: response.order.status,
      }));
      await AsyncStorage.setItem('cart', JSON.stringify([]));
      Alert.alert(
        'Commande Soumise',
        `Numéro de commande : ${orderNumber}\nMéthode : ${paymentMethod}\nLivraison : ${deliveryType}\nTotal : ${response.order.totalAmount} FCFA\nStatut : ${response.order.status}`,
        [{ text: 'OK', onPress: () => navigation.navigate('Tracking') }]
      );
    } catch (error) {
      console.log('Erreur lors de la soumission de la commande:', error.message);
      Alert.alert('Erreur', `Impossible de soumettre la commande: ${error.message}`);
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

        <View style={styles.receiptTable}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Nom</Text>
            <Text style={styles.tableHeaderText}>Prix (FCFA)</Text>
            <Text style={styles.tableHeaderText}>Qté</Text>
            <Text style={styles.tableHeaderText}>Total (FCFA)</Text>
          </View>
          {order?.products?.length > 0 ? (
            order.products.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{item.productId?.name || 'Produit inconnu'}</Text>
                <Text style={styles.tableCell}>{item.productId?.price || 0}</Text>
                <Text style={styles.tableCell}>{item.quantity}</Text>
                <Text style={styles.tableCell}>{(item.productId?.price || 0) * item.quantity}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.tableCell}>Aucun produit dans cette commande</Text>
          )}
        </View>

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

        <Text style={styles.sectionTitle}>Choisir un Mode de Paiement</Text>
        <View style={styles.cardContainer}>
          {[
            { value: 'Flooz', label: 'Flooz', disabled: true },
            { value: 'TMoney', label: 'TMoney', disabled: true },
            { value: 'wallet', label: 'Wallet', disabled: true },
            { value: 'cash', label: 'Espèces', disabled: false }, // Seule option disponible
          ].map((method) => (
            <TouchableOpacity
              key={method.value}
              style={[
                styles.paymentCard,
                paymentMethod === method.value && styles.selectedCard,
                method.disabled && styles.disabledCard, // Style pour les options désactivées
              ]}
              onPress={() => {
                if (!method.disabled) {
                  setPaymentMethod(method.value);
                  console.log('Méthode sélectionnée:', method.value);
                }
              }}
              disabled={method.disabled} // Désactive les clics sur les options non disponibles
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
              onPress={() => setDeliveryType(type.toLowerCase())}
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
  disabledCard: {
    backgroundColor: '#f0f0f0', // Fond grisé
    opacity: 0.6,
    borderColor: '#ccc', // Bordure plus claire
  },
  disabledText: {
    textDecorationLine: 'line-through', // Ligne barrée
    color: '#888', // Texte grisé
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
});