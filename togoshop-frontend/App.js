import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, ImageBackground } from 'react-native';
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
        duration: 1200,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(iconFadeAnim, {
        toValue: 1,
        duration: 1500,
        delay: 600,
        easing: Easing.out(Easing.elastic(0.8)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, iconFadeAnim]);

  if (!role) {
    return (
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=1350&q=80' }} // Fond de route/livraison
        style={styles.background}
        imageStyle={styles.backgroundImage}
      >
        <View style={styles.overlay}>
          <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.brand}>Togoshop</Text>
            <Text style={styles.subtitle}>Vos courses en un clic</Text>
          </Animated.View>
          <Animated.View style={[styles.mainCardContainer, { opacity: fadeAnim }]}>
            <TouchableOpacity
              style={[styles.mainCard, styles.clientCard]}
              onPress={() => setRole('client')}
              activeOpacity={0.85}
            >
              <Ionicons name="cart-outline" size={70} color="#fff" />
              <Text style={styles.mainCardText}>Découvrir les Produits</Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[styles.bottomIconsContainer, { opacity: iconFadeAnim }]}>
            <TouchableOpacity
              style={[styles.iconButton, styles.managerIcon]}
              onPress={() => setRole('manager')}
              activeOpacity={0.85}
            >
              <Ionicons name="briefcase" size={35} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, styles.driverIcon]}
              onPress={() => setRole('driver')}
              activeOpacity={0.85}
            >
              <Ionicons name="car" size={35} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ImageBackground>
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
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    opacity: 0.2, // Subtilité pour ne pas masquer le contenu
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Overlay sombre pour contraste
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
  },
  brand: {
    fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#D1D5DB',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  mainCardContainer: {
    alignItems: 'center',
  },
  mainCard: {
    width: 250,
    height: 280,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.51)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    overflow: 'hidden',
    backgroundImage: 'linear-gradient(135deg, #6c5ce7, #81ecec)',
  },
  clientCard: {
    backgroundImage: 'linear-gradient(135deg, #6c5ce7, #81ecec)', 
  },
  mainCardText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  bottomIconsContainer: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    paddingHorizontal: 20,
  },
  iconButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Effet verre givré
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1))',
  },
  managerIcon: {
    backgroundImage: 'linear-gradient(135deg, #2ecc71, #27ae60)', // Vert dégradé
  },
  driverIcon: {
    backgroundImage: 'linear-gradient(135deg, #f39c12, #e67e22)', // Orange dégradé
  },
});