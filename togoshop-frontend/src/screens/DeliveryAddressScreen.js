import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { updateOrder } from '../services/api';

export default function DeliveryAddressScreen({ route, navigation }) {
  const { orderId } = route.params || {};
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState({
    latitude: 6.1725,
    longitude: 1.2314,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Erreur', 'Permission de localisation refusée.');
        return;
      }

      let userLocation = await Location.getCurrentPositionAsync({});
      setLocation(userLocation);
      setRegion({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();
  }, []);

  const onRegionChangeComplete = (newRegion) => {
    setRegion(newRegion);
  };

  const handleSaveAddress = async () => {
    if (!address.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse valide.');
      return;
    }

    try {
      const updatedData = {
        deliveryAddress: {
          address,
          lat: region.latitude,
          lng: region.longitude,
        },
      };
      console.log('Mise à jour de la commande:', { orderId, updatedData });
      await updateOrder(orderId, updatedData);
      Alert.alert('Succès', 'Adresse enregistrée avec succès.');
      navigation.navigate('Payment', { orderId });
    } catch (error) {
      console.log('Erreur lors de l\'enregistrement de l\'adresse:', error.message);
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'adresse : ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Choisir une Adresse de Livraison</Text>
      </View>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={true}
      >
        <Marker
          coordinate={{
            latitude: region.latitude,
            longitude: region.longitude,
          }}
          draggable
          onDragEnd={(e) =>
            setRegion({
              ...region,
              latitude: e.nativeEvent.coordinate.latitude,
              longitude: e.nativeEvent.coordinate.longitude,
            })
          }
        />
      </MapView>
      <View style={styles.addressContainer}>
        <TextInput
          style={styles.addressInput}
          placeholder="Entrez les détails de l'adresse (ex. Rue, Quartier)"
          value={address}
          onChangeText={setAddress}
          multiline
        />
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveAddress}>
          <Text style={styles.saveButtonText}>Enregistrer et Continuer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    elevation: 2,
  },
  backButton: {
    marginRight: 10,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  map: {
    flex: 1,
  },
  addressContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    elevation: 2,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 15,
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});