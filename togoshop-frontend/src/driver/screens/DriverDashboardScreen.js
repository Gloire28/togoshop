import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getDriverInfo, updateDriverLocation, toggleDriverDiscoverable } from '../../shared/services/api';

export default function DriverDashboardScreen() {
  const [driverName, setDriverName] = useState('');
  const [status, setStatus] = useState('offline');
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    fetchDriverInfo();
    requestLocationPermission();
    // Mettre à jour la position toutes les 5 minutes
    const locationInterval = setInterval(updateLocation, 5 * 60 * 1000);
    return () => clearInterval(locationInterval);
  }, []);

  const fetchDriverInfo = async () => {
    setLoading(true);
    try {
      const driverInfo = await getDriverInfo();
      setDriverName(driverInfo.name);
      setStatus(driverInfo.status);
      setIsDiscoverable(driverInfo.isDiscoverable);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les informations');
    } finally {
      setLoading(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L’accès à la localisation est requis.');
        return;
      }
      updateLocation();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de demander la permission de localisation');
    }
  };

  const updateLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const { latitude: lat, longitude: lng } = location.coords;
      await updateDriverLocation(lat, lng);
      console.log('Position mise à jour automatiquement:', { lat, lng });
    } catch (error) {
      console.log('Erreur lors de la mise à jour automatique de la position:', error.message);
    }
  };

  const toggleDiscoverableStatus = async () => {
    try {
      const response = await toggleDriverDiscoverable();
      setIsDiscoverable(response.isDiscoverable);
      Alert.alert('Succès', `Détectabilité ${response.isDiscoverable ? 'activée' : 'désactivée'}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour la détectabilité');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    navigation.replace('DriverLogin');
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : (
        <>
          <Text style={styles.title}>Bienvenue, {driverName} !</Text>
          <Text style={styles.status}>Statut : {status}</Text>
          <Text style={styles.status}>Détectable : {isDiscoverable ? 'Oui' : 'Non'}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={toggleDiscoverableStatus}
          >
            <Text style={styles.buttonText}>
              {isDiscoverable ? 'Désactiver Détectabilité' : 'Activer Détectabilité'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('DriverOrders')}
          >
            <Text style={styles.buttonText}>Voir mes Commandes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('DriverEarnings')}
          >
            <Text style={styles.buttonText}>Voir mes Gains</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.buttonText}>Déconnexion</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  status: {
    fontSize: 18,
    color: '#34495e',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 15,
    width: '80%',
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});