import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getDriverOrders, acceptOrder, rejectOrder, updateDriverOrderStatus } from '../../shared/services/api';

export default function DriverOrderScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await getDriverOrders();
      setOrders(response || []);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  };

  const acceptOrderHandler = async (orderId) => {
    try {
      await acceptOrder(orderId);
      Alert.alert('Succès', 'Commande acceptée');
      fetchOrders();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d’accepter la commande');
    }
  };

  const rejectOrderHandler = async (orderId) => {
    try {
      await rejectOrder(orderId);
      Alert.alert('Succès', 'Commande rejetée');
      fetchOrders();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de rejeter la commande');
    }
  };

  const markAsDelivered = async (orderId) => {
    try {
      await updateDriverOrderStatus(orderId, 'delivered');
      Alert.alert('Succès', 'Commande marquée comme livrée');
      fetchOrders();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    }
  };

  const markAsInDelivery = async (orderId) => {
    try {
      await updateDriverOrderStatus(orderId, 'in_delivery');
      Alert.alert('Succès', 'Commande marquée comme en livraison');
      fetchOrders();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    }
  };

  const renderOrder = ({ item }) => {
    const statusColors = {
      validated: '#F97316', // Orange pour en attente
      ready_for_pickup: '#3B82F6', // Bleu pour prête
      in_delivery: '#10B981', // Vert pour en livraison
    };

    const statusIcons = {
      validated: 'clock-outline',
      ready_for_pickup: 'package-variant',
      in_delivery: 'truck-delivery',
    };

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>Commande #{item._id.substring(0, 8)}...</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || '#6B7280' }]}>
            <Icon name={statusIcons[item.status] || 'help-circle'} size={16} color="#fff" style={styles.statusIcon} />
            <Text style={styles.statusText}>
              {item.status === 'validated' ? 'En attente' : item.status === 'ready_for_pickup' ? 'Prête' : 'En livraison'}
            </Text>
          </View>
        </View>
        <Text style={styles.orderText}>
          <Icon name="account" size={16} color="#1E3A8A" /> Client: {item.clientId?.name || 'Inconnu'}
        </Text>
        <Text style={styles.orderText}>
          <Icon name="map-marker" size={16} color="#1E3A8A" /> Adresse: {item.deliveryAddress?.address}
        </Text>
        <Text style={styles.orderText}>
          <Icon name="cash" size={16} color="#1E3A8A" /> Total: {item.totalAmount} FCFA
        </Text>
        <Text style={styles.orderText}>
          <Icon name="truck" size={16} color="#1E3A8A" /> Frais: {item.deliveryFee} FCFA
        </Text>

        {/* Afficher les commandes groupées dans la même zone */}
        {item.zoneId && item.status === 'ready_for_pickup' && (
          <Text style={styles.zoneText}>
            <Icon name="group" size={16} color="#F97316" /> Zone #{item.zoneId.substring(0, 8)}... ({orders.filter(o => o.zoneId === item.zoneId).length} commandes)
          </Text>
        )}

        {/* Actions selon le statut */}
        {item.status === 'validated' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={() => acceptOrderHandler(item._id)}
            >
              <Icon name="check" size={16} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Accepter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.rejectButton]}
              onPress={() => rejectOrderHandler(item._id)}
            >
              <Icon name="close" size={16} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Refuser</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.status === 'ready_for_pickup' && (
          <TouchableOpacity
            style={[styles.button, styles.inDeliveryButton]}
            onPress={() => markAsInDelivery(item._id)}
          >
            <Icon name="truck-delivery" size={16} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Démarrer Livraison</Text>
          </TouchableOpacity>
        )}
        {item.status === 'in_delivery' && (
          <TouchableOpacity
            style={[styles.button, styles.deliveredButton]}
            onPress={() => markAsDelivered(item._id)}
          >
            <Icon name="check-circle" size={16} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Marquer comme Livrée</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#1E3A8A', '#10B981']}
      style={styles.container}
    >
      <Text style={styles.title}>Mes Commandes</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : orders.length === 0 ? (
        <View style={styles.noOrdersContainer}>
          <Icon name="package-variant-closed" size={50} color="#E5E7EB" />
          <Text style={styles.noOrders}>Aucune commande en cours</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item._id}
          style={styles.orderList}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Poppins-Bold',
  },
  orderList: {
    flex: 1,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
  },
  orderId: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E3A8A',
    fontFamily: 'Poppins-SemiBold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusIcon: {
    marginRight: 5,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
  },
  orderText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#1E3A8A',
    fontFamily: 'Poppins-Regular',
  },
  zoneText: {
    fontSize: 14,
    color: '#F97316',
    marginBottom: 10,
    fontFamily: 'Poppins-Medium',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  acceptButton: {
    backgroundColor: '#10B981',
    flex: 1,
    marginRight: 5,
  },
  rejectButton: {
    backgroundColor: '#EF4444',
    flex: 1,
    marginLeft: 5,
  },
  inDeliveryButton: {
    backgroundColor: '#3B82F6',
  },
  deliveredButton: {
    backgroundColor: '#10B981',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  buttonIcon: {
    marginRight: 8,
  },
  noOrdersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noOrders: {
    fontSize: 18,
    textAlign: 'center',
    color: '#E5E7EB',
    marginTop: 20,
    fontFamily: 'Poppins-Regular',
  },
});