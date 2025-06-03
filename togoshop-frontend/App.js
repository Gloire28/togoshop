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
    backgroundColor: 'linear-gradient(135deg, #dfe9f3, #ffffff)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  brand: {
    fontSize: 42,
    fontWeight: '800',
    color: '#27ae60',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 5,
    textAlign: 'center',
  },
  mainCard: {
    width: 200,
    height: 250,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    marginBottom: 40,
  },
  clientCard: {
    backgroundColor: 'linear-gradient(45deg, #e74c3c, #c0392b)',
  },
  mainCardText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  bottomIconsContainer: {
    position: 'absolute',
    bottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 30,
  },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  managerIcon: {
    backgroundColor: 'linear-gradient(45deg, #27ae60, #219653)',
  },
  driverIcon: {
    backgroundColor: 'linear-gradient(45deg, #e67e22, #d35400)',
  },
});