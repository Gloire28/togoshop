import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getDriverInfo, updateDriverLocation, toggleDriverDiscoverable } from '../../shared/services/api';

export default function DriverDashboardScreen() {
  const [driverName, setDriverName] = useState('');
  const [status, setStatus] = useState('offline');
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const [scaleValue] = useState(new Animated.Value(1));

  useEffect(() => {
    fetchDriverInfo();
    requestLocationPermission();
    const locationInterval = setInterval(updateLocation, 5 * 60 * 1000);
    return () => clearInterval(locationInterval);
  }, []);

  const fetchDriverInfo = async () => {
    setLoading(true);
    try {
      const driverInfo = await getDriverInfo();
      setDriverName(driverInfo.name || 'Conducteur');
      setStatus(driverInfo.status || 'offline');
      setIsDiscoverable(driverInfo.isDiscoverable ?? driverInfo.discoverable ?? false);
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
      const newDiscoverable = response.isDiscoverable ?? response.discoverable ?? !isDiscoverable;
      setIsDiscoverable(newDiscoverable);
      Alert.alert('Succès', `Détectabilité ${newDiscoverable ? 'activée' : 'désactivée'}`);
      Animated.sequence([
        Animated.timing(scaleValue, { toValue: 1.1, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleValue, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour la détectabilité');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    navigation.replace('DriverLogin');
  };

  const handlePressIn = () => {
    Animated.spring(scaleValue, { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#4B5563" style={styles.loader} />
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Tableau de Bord</Text>
            <Text style={styles.subtitle}>Bienvenue, {driverName} !</Text>
          </View>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Statut</Text>
              <View style={styles.statusIndicator}>
                <Icon
                  name={status === 'available' ? 'check-circle' : 'close-circle'}
                  size={16}
                  color={status === 'available' ? '#16A34A' : '#DC2626'}
                  style={styles.statusIcon}
                />
                <Text style={[styles.statusText, { color: status === 'available' ? '#16A34A' : '#DC2626' }]}>
                  {status === 'available' ? 'Disponible' : 'Indisponible'}
                </Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Détectabilité</Text>
              <View style={styles.statusIndicator}>
                <Icon
                  name={isDiscoverable ? 'eye' : 'eye-off'}
                  size={16}
                  color={isDiscoverable ? '#2563EB' : '#6B7280'}
                  style={styles.statusIcon}
                />
                <Text style={[styles.statusText, { color: isDiscoverable ? '#2563EB' : '#6B7280' }]}>
                  {isDiscoverable ? 'Activée' : 'Désactivée'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.actions}>
            <Animated.View style={[styles.actionCard, { transform: [{ scale: scaleValue }] }]}>
              <TouchableOpacity
                style={[styles.actionButton, isDiscoverable ? styles.toggleOffButton : styles.toggleOnButton]}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={toggleDiscoverableStatus}
              >
                <Icon name={isDiscoverable ? 'eye-off' : 'eye'} size={24} color="#FFFFFF" style={styles.cardIcon} />
                <Text style={styles.actionText}>
                  {isDiscoverable ? 'Désactiver Détect.' : 'Activer Détect.'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[styles.actionCard, { transform: [{ scale: scaleValue }] }]}>
              <TouchableOpacity
                style={styles.actionButton}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={() => navigation.navigate('DriverOrders')}
              >
                <Icon name="truck" size={24} color="#FFFFFF" style={styles.cardIcon} />
                <Text style={styles.actionText}>Mes Commandes</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[styles.actionCard, { transform: [{ scale: scaleValue }] }]}>
              <TouchableOpacity
                style={styles.actionButton}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={() => navigation.navigate('DriverEarnings')}
              >
                <Icon name="wallet" size={24} color="#FFFFFF" style={styles.cardIcon} />
                <Text style={styles.actionText}>Mes Gains</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[styles.actionCard, { transform: [{ scale: scaleValue }] }]}>
              <TouchableOpacity
                style={[styles.actionButton, styles.logoutButton]}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleLogout}
              >
                <Icon name="logout" size={24} color="#FFFFFF" style={styles.cardIcon} />
                <Text style={styles.actionText}>Déconnexion</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
    marginTop: 4,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#4B5563',
    fontFamily: 'Poppins-Medium',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  actions: {
    gap: 12,
  },
  actionCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#4B5563',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleOnButton: {
    backgroundColor: '#16A34A',
  },
  toggleOffButton: {
    backgroundColor: '#DC2626',
  },
  logoutButton: {
    backgroundColor: '#9CA3AF',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
  },
  cardIcon: {
    marginRight: 12,
  },
});