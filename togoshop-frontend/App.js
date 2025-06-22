import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider } from './src/shared/context/AppContext';
import ClientNavigator from './src/client/navigation/AppNavigator';
import ManagerNavigator from './src/manager/navigation/ManagerNavigator';
import DriverNavigator from './src/driver/navigation/DriverNavigator';

export default function App() {
  const [role, setRole] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [iconFadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(iconFadeAnim, {
        toValue: 1,
        duration: 1200,
        delay: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, iconFadeAnim]);

  if (!role) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.brand}>Togoshop</Text>
          <Text style={styles.subtitle}>Vos courses en un clic</Text>
        </Animated.View>
        <TouchableOpacity
          style={[styles.mainCard, styles.clientCard]}
          onPress={() => setRole('client')}
          activeOpacity={0.8}
        >
          <Ionicons name="cart-outline" size={60} color="#fff" />
          <Text style={styles.mainCardText}>Découvrir les Produits</Text>
        </TouchableOpacity>
        <Animated.View style={[styles.bottomIconsContainer, { opacity: iconFadeAnim }]}>
          <TouchableOpacity
            style={[styles.iconButton, styles.managerIcon]}
            onPress={() => setRole('manager')}
            activeOpacity={0.8}
          >
            <Ionicons name="briefcase" size={30} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.driverIcon]}
            onPress={() => setRole('driver')}
            activeOpacity={0.8}
          >
            <Ionicons name="car" size={30} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <AppProvider>
      <NavigationContainer>
        {role === 'client' && <ClientNavigator />}
        {role === 'manager' && <ManagerNavigator />}
        {role === 'driver' && <DriverNavigator />}
      </NavigationContainer>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f6fd',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  brand: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#3498db',
    textAlign: 'center',
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 16,
    color: '#95a5a6',
    marginTop: 5,
    textAlign: 'center',
  },
  mainCard: {
    width: 230,
    height: 260,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6c5ce7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    marginBottom: 50,
  },
  clientCard: {
    backgroundColor: '#6c5ce7', // Lavande
  },
  mainCardText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 15,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottomIconsContainer: {
    position: 'absolute',
    bottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 40,
  },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ecf0f1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  managerIcon: {
    backgroundColor: '#2ecc71', // Vert doux
  },
  driverIcon: {
    backgroundColor: '#f39c12', // Orange pastel
  },
});
