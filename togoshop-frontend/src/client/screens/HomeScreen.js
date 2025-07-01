import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { getUserOrders } from '../../shared/services/api';

export default function HomeScreen({ navigation }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await getUserOrders();
        setOrders(data || []);
        console.log('Orders disponibles dans HomeScreen:', data);
      } catch (error) {
        console.log('Erreur lors de la récupération des commandes:', error);
        setOrders([]);
      }
    };
    fetchOrders();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenue sur TogoShop!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, marginBottom: 20 },
  button: { backgroundColor: '#4A90E2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25, marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});