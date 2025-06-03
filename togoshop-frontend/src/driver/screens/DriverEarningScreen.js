import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { getDriverInfo, getDriverOrders } from '../../shared/services/api';

export default function DriverEarningScreen() {
  const [earnings, setEarnings] = useState(0);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEarningsAndOrders();
  }, []);

  const fetchEarningsAndOrders = async () => {
    setLoading(true);
    try {
      const driverInfo = await getDriverInfo();
      setEarnings(driverInfo.earnings || 0);

      const response = await getDriverOrders();
      const deliveredOrders = (response || []).filter(order =>
        order.status === 'delivered' && order.driverId
      );
      setOrders(deliveredOrders);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les gains ou l’historique');
    } finally {
      setLoading(false);
    }
  };

  const renderOrder = ({ item }) => (
    <View style={styles.orderCard}>
      <Text style={styles.orderId}>Commande #{item._id.substring(0, 8)}...</Text>
      <Text style={styles.orderText}>Client: {item.clientId?.name || 'Inconnu'}</Text>
      <Text style={styles.orderText}>Total: {item.totalAmount} FCFA</Text>
      <Text style={styles.orderText}>Frais de livraison: {item.deliveryFee} FCFA</Text>
      <Text style={styles.orderText}>Date: {new Date(item.updatedAt).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mes Gains</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : (
        <>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>Gains Totaux</Text>
            <Text style={styles.earningsAmount}>{earnings} FCFA</Text>
          </View>
          <Text style={styles.subtitle}>Historique des Livraisons</Text>
          {orders.length === 0 ? (
            <Text style={styles.noOrders}>Aucune livraison terminée</Text>
          ) : (
            <FlatList
              data={orders}
              renderItem={renderOrder}
              keyExtractor={(item) => item._id}
              style={styles.orderList}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 20,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#2c3e50',
  },
  earningsCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  earningsLabel: {
    fontSize: 18,
    color: '#34495e',
    marginBottom: 10,
  },
  earningsAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  orderList: {
    flex: 1,
  },
  orderCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 2,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  orderText: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 5,
  },
  noOrders: {
    fontSize: 16,
    textAlign: 'center',
    color: '#7f8c8d',
  },
});