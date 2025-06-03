import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { apiRequest, getManagerOrders } from '../../shared/services/api';

export default function OrderHistoryScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    const initialize = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        if (storedToken) {
          setToken(storedToken);
          fetchOrders();
        } else {
          Alert.alert('Erreur', 'Utilisateur non authentifié', [
            { text: 'OK', onPress: () => navigation.navigate('Login') },
          ]);
        }
      } catch (error) {
        Alert.alert('Erreur', 'Impossible de charger les données');
      }
    };
    initialize();
  }, [navigation]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await getManagerOrders();
      // Filtrer les commandes terminées ou en cours de livraison
      const filteredOrders = (response.orders || []).filter(order =>
        ['ready_for_delivery', 'in_delivery', 'delivered', 'cancelled'].includes(order.status)
      );
      setOrders(filteredOrders);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  };

  const renderProduct = ({ item }) => {
    return (
      <View style={styles.productCard}>
        <Image
          source={{ uri: item.productId?.photoUrl || 'https://via.placeholder.com/50' }}
          style={styles.productImage}
        />
        <View style={styles.productDetails}>
          <Text style={styles.productName}>{item.productId?.name || 'Produit inconnu'}</Text>
          <Text style={styles.productQuantity}>Quantité: {item.quantity}</Text>
          <Text style={styles.productComment}>{item.comment || 'Aucun commentaire'}</Text>
        </View>
      </View>
    );
  };

  const renderOrder = ({ item }) => {
    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>Commande #{item._id.substring(0, 8)}...</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
          </View>
        </View>
        <Text style={styles.orderText}>Client: {item.clientId?.name || 'Inconnu'}</Text>
        <Text style={styles.orderText}>Adresse: {item.deliveryAddress?.address}</Text>
        <Text style={styles.orderText}>Total: {item.totalAmount} FCFA</Text>
        <Text style={styles.orderText}>Frais de livraison: {item.deliveryFee} FCFA</Text>
        <FlatList
          data={item.products}
          renderItem={renderProduct}
          keyExtractor={(product) => product._id}
          style={styles.productList}
          ItemSeparatorComponent={() => <View style={styles.productSeparator} />}
        />
      </View>
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'validated': return '#28a745';
      case 'ready_for_delivery': return '#3498db';
      case 'in_delivery': return '#e67e22';
      case 'delivered': return '#2ecc71';
      case 'cancelled': return '#dc3545';
      case 'awaiting_validator': return '#f1c40f';
      case 'pending_validation': return '#f1c40f';
      default: return '#3498db';
    }
  };

  if (!token) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#007bff" /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Historique des Commandes</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : orders.length === 0 ? (
        <Text style={styles.noOrders}>Aucune commande terminée</Text>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item._id}
          style={styles.orderList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 20, backgroundColor: '#f5f5f5', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#2c3e50' },
  orderList: { flex: 1 },
  orderCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    marginBottom: 15, 
    borderRadius: 10, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4,
  },
  orderHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 10,
  },
  orderId: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  orderText: { fontSize: 16, marginBottom: 8, color: '#34495e', fontWeight: '500' },
  productList: { marginBottom: 15 },
  productSeparator: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 5 },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginVertical: 5,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  productQuantity: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  productComment: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#7f8c8d',
  },
  noOrders: {
    fontSize: 16,
    textAlign: 'center',
    color: '#7f8c8d',
  },
});