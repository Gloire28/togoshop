import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen({ navigation }) {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const handleLogout = () => {
    // Logique de déconnexion ici (par exemple, vider le token et naviguer vers l'écran de login)
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }], // Remplace 'Login' par le nom de ton écran de login
    });
  };

  return (
    <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Tableau de Bord Manager</Text>
        <Text style={styles.subtitle}>Le centre de commande</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out" size={30} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
      <Animated.View style={[styles.cardsContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Orders')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="list" size={30} color="#fff" />
          </View>
          <Text style={styles.cardTitle}>Commandes</Text>
          <Text style={styles.cardDescription}>Traiter et valider les commandes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Products')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="cube" size={30} color="#fff" />
          </View>
          <Text style={styles.cardTitle}>Produits</Text>
          <Text style={styles.cardDescription}>Ajouter ou modifier des produits</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Stock')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="archive" size={30} color="#fff" />
          </View>
          <Text style={styles.cardTitle}>Stocks</Text>
          <Text style={styles.cardDescription}>Mettre à jour les stocks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('OrderHistory')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="time" size={30} color="#fff" />
          </View>
          <Text style={styles.cardTitle}>Historique</Text>
          <Text style={styles.cardDescription}>Voir les commandes terminées</Text>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 40, position: 'relative' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: 16, color: '#d1d8e0', marginTop: 5, fontStyle: 'italic' },
  cardsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 5 },
  cardDescription: { fontSize: 14, color: '#d1d8e0', textAlign: 'center' },
  logoutButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
  },
});