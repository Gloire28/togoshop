import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  ImageBackground,
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
  const [fadeValue] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeValue, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
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
        Animated.timing(scaleValue, { toValue: 1.1, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleValue, { toValue: 1, duration: 150, useNativeDriver: true }),
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
    Animated.spring(scaleValue, { toValue: 0.95, friction: 5, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  return (
    <ImageBackground
      source={{ uri: 'https://plus.unsplash.com/premium_vector-1727509833113-29685669ab5f?q=80&w=1267&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }} // Fond subtil de route/livraison
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <Animated.View style={[styles.container, { opacity: fadeValue }]}>
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
      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    opacity: 0.15, // Subtilité accrue pour ne pas distraire
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  statusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusLabel: {
    fontSize: 15,
    color: '#4B5563',
    fontWeight: '500',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  actionCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Effet de verre givré
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#4B5563',
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
    borderRadius: 12,
  },
  toggleOnButton: {
    backgroundColor: '#16A34A',
    backgroundImage: 'linear-gradient(135deg, #16A34A, #22C55E)',
  },
  toggleOffButton: {
    backgroundColor: '#DC2626',
    backgroundImage: 'linear-gradient(135deg, #DC2626, #EF4444)',
  },
  logoutButton: {
    backgroundColor: '#9CA3AF',
    backgroundImage: 'linear-gradient(135deg, #9CA3AF, #D1D5DB)',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardIcon: {
    marginRight: 12,
  },
});