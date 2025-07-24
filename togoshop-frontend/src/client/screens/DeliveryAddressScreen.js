import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { updateOrder } from '../../shared/services/api';
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

export default function DeliveryAddressScreen({ route, navigation }) {
  const { orderId } = route.params || {};
  const { cart, fetchCart, loyaltyPointsUsed, loyaltyReductionAmount } = useContext(AppContext);
  const [address, setAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);

  useEffect(() => {
    if (!orderId) {
      console.log('Erreur: orderId manquant dans route.params');
      Alert.alert('Erreur', 'Aucune commande valide trouvée. Retournez au panier.');
      navigation.goBack();
      return;
    }

    // Synchroniser les données du panier au chargement
    const loadCartData = async () => {
      try {
        const cartResponse = await fetchCart();
        console.log('Réponse fetchCart dans DeliveryAddressScreen:', JSON.stringify(cartResponse, null, 2));
        console.log('Données reçues:', { orderId, cartLength: cart.length, loyaltyPointsUsed, loyaltyReductionAmount });
      } catch (error) {
        console.error('Erreur lors de la synchronisation du panier:', error.message);
        Alert.alert('Erreur', 'Impossible de synchroniser le panier : ' + error.message);
      }
    };
    loadCartData();

    // Récupérer la localisation
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission de localisation refusée');
        Alert.alert('Erreur', 'Permission de localisation refusée. Utilisez des coordonnées manuelles.');
        setLatitude(6.1725);
        setLongitude(1.2314);
        return;
      }

      try {
        let userLocation = await Location.getCurrentPositionAsync({});
        setLatitude(userLocation.coords.latitude);
        setLongitude(userLocation.coords.longitude);
        console.log('Localisation récupérée:', { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude });
      } catch (error) {
        console.error('Erreur de localisation:', error.message);
        Alert.alert('Erreur', 'Impossible de récupérer la localisation. Utilisez des coordonnées manuelles.');
        setLatitude(6.1725);
        setLongitude(1.2314);
      }
    })();
  }, [orderId, navigation, fetchCart, cart.length, loyaltyPointsUsed, loyaltyReductionAmount]);

  const handleSaveAddress = async () => {
    if (!address.trim() || !latitude || !longitude) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse et vérifier la localisation.');
      return;
    }

    try {
      const updatedData = {
        deliveryAddress: {
          address,
          lat: latitude,
          lng: longitude,
          instructions: deliveryInstructions || '',
        },
        products: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          alternativeLocationId: item.alternativeLocationId || '',
          comment: item.comment || '',
          photoUrl: item.photoUrl || '',
          promotedPrice: item.promotedPrice || null,
        })),
      };
      console.log('Mise à jour de la commande:', { orderId, updatedData });
      await updateOrder(orderId, updatedData);
      console.log('Navigation vers PaymentScreen avec:', { orderId, deliveryAddress: updatedData.deliveryAddress });
      Alert.alert('Succès', 'Adresse enregistrée avec succès.');
      navigation.navigate('Payment', { orderId, deliveryAddress: updatedData.deliveryAddress });
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'adresse:', error.message);
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'adresse : ' + error.message);
    }
  };

  return (
    <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <ProgressBar currentStep={2} />
        </View>
        <View style={styles.content}>
          <Text style={styles.locationText}>
            Localisation actuelle : Lat {latitude?.toFixed(4) || 'N/A'}, Lng {longitude?.toFixed(4) || 'N/A'}
          </Text>
          <TextInput
            style={styles.addressInput}
            placeholder="Entrez les détails de l'adresse (ex. Rue, Quartier)"
            value={address}
            onChangeText={setAddress}
            multiline
          />
          <TextInput
            style={styles.instructionsInput}
            placeholder="Instructions pour le livreur (ex. Entrée par derrière)"
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
            multiline
          />
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveAddress}>
            <Text style={styles.saveButtonText}>Enregistrer et Continuer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
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
  content: {
    flex: 1,
    padding: 20,
  },
  progressBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
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
  locationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
    elevation: 2,
    height: 100,
    textAlignVertical: 'top',
  },
  instructionsInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
    elevation: 2,
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});