import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, UrlTile } from 'react-native-maps';
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
  const [selectedLat, setSelectedLat] = useState(null);
  const [selectedLng, setSelectedLng] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!orderId) {
      console.log('Erreur: orderId manquant dans route.params');
      Alert.alert('Erreur', 'Aucune commande valide trouvée. Retournez au panier.');
      navigation.goBack();
      return;
    }

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

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission de localisation refusée');
        Alert.alert('Erreur', 'Permission de localisation refusée. Utilisez une sélection manuelle.');
        setLatitude(6.1725);
        setLongitude(1.2314);
        return;
      }

      try {
        let userLocation = await Location.getCurrentPositionAsync({});
        setLatitude(userLocation.coords.latitude);
        setLongitude(userLocation.coords.longitude);
        setSelectedLat(userLocation.coords.latitude);
        setSelectedLng(userLocation.coords.longitude);
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      } catch (error) {
        console.error('Erreur de localisation:', error.message);
        Alert.alert('Erreur', 'Impossible de récupérer la localisation. Utilisez une sélection manuelle.');
        setLatitude(6.1725);
        setLongitude(1.2314);
      }
    })();
  }, [orderId, fetchCart]);

  const onMapPress = (event) => {
    const { coordinate } = event.nativeEvent;
    setSelectedLat(coordinate.latitude);
    setSelectedLng(coordinate.longitude);
  };

  const handleSaveAddress = async () => {
    if (!deliveryInstructions.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer des instructions de livraison.');
      return;
    }

    try {
      const updatedData = {
        deliveryAddress: {
          address: address.trim() || '',
          lat: selectedLat || latitude,
          lng: selectedLng || longitude,
          instructions: deliveryInstructions,
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
        <View style={styles.mapContainer}>
          {latitude && longitude && (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: latitude,
                longitude: longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={onMapPress}
            >
              <UrlTile
                urlTemplate="http://c.tile.openstreetmap.org/{z}/{x}/{y}.png" // URL pour OSM
                maximumZ={19} // Zoom max, iOS only
                flipY={false} // Pour éviter l'inversion des tuiles
              />
              {(selectedLat && selectedLng) && (
                <Marker
                  coordinate={{ latitude: selectedLat, longitude: selectedLng }}
                  title="Position sélectionnée"
                />
              )}
              {(!selectedLat && !selectedLng) && (
                <Marker
                  coordinate={{ latitude, longitude }}
                  title="Position actuelle"
                />
              )}
            </MapView>
          )}
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.addressInput}
            placeholder="Adresse (facultatif)"
            value={address}
            onChangeText={setAddress}
            multiline
          />
          <TextInput
            style={styles.instructionsInput}
            placeholder="Instructions pour le livreur (obligatoire)"
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
  mapContainer: { flex: 1, marginTop: 10 },
  map: { width: '100%', height: '100%' },
  inputContainer: {
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    elevation: 2,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
    height: 60,
    textAlignVertical: 'top',
  },
  instructionsInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
    height: 60,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#28a745',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  progressCircleActive: { backgroundColor: '#28a745' },
  progressCircleInactive: { backgroundColor: '#ddd' },
  progressText: { fontSize: 12, fontWeight: 'bold' },
  progressTextActive: { color: '#fff' },
  progressTextInactive: { color: '#666' },
  progressLabel: { fontSize: 10, textAlign: 'center' },
  progressLabelActive: { color: '#28a745', fontWeight: 'bold' },
  progressLabelInactive: { color: '#666' },
  connector: {
    position: 'absolute',
    top: 11,
    left: '50%',
    width: '100%',
    height: 2,
    zIndex: -1,
  },
  connectorActive: { backgroundColor: '#28a745' },
  connectorInactive: { backgroundColor: '#ddd' },
});