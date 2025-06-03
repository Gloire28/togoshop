import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, Switch, TouchableOpacity, Image, Modal, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { apiRequest, getManagerInfo, getManagerOrders } from '../../shared/services/api';

export default function OrderScreen() {
  const [isAvailable, setIsAvailable] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [checkedProducts, setCheckedProducts] = useState({});
  const [fadeAnim] = useState(new Animated.Value(0)); // Animation pour nouvelle commande
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    const initialize = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        if (storedToken) {
          setToken(storedToken);
          fetchManagerInfo(storedToken);
          fetchOrders(storedToken);
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

  const fetchManagerInfo = async () => {
    try {
      const response = await getManagerInfo();
      setIsAvailable(response.isAvailable);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les informations du manager');
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await getManagerOrders();
      // Filtrer uniquement les commandes pertinentes pour le manager
      const filteredOrders = (response.orders || [])
        .filter(order => ['awaiting_validator', 'pending_validation'].includes(order.status))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // Trier par date (plus ancienne d'abord)
      setOrders(filteredOrders);
      const initialChecked = filteredOrders.reduce((acc, order) => ({
        ...acc,
        [order._id]: order.products.reduce((prodAcc, prod) => ({
          ...prodAcc,
          [prod._id]: false,
        }), {}),
      }), {});
      setCheckedProducts(initialChecked);
      // Lancer l'animation pour la nouvelle commande
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async (newStatus) => {
    try {
      const response = await apiRequest('/managers/me/availability', {
        method: 'PUT',
        body: { isAvailable: newStatus },
      });
      setIsAvailable(newStatus);
      Alert.alert('Succès', response.message);
      fetchOrders();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour la disponibilité');
    }
  };

  const toggleProductCheck = (orderId, productId, value) => {
    setCheckedProducts((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [productId]: value,
      },
    }));
  };

  const updateOrderStatus = async (orderId, status, reason = null) => {
    try {
      const body = { status };
      if (reason) body.reason = reason; // Ajouter la raison si fournie
      const response = await apiRequest(`/orders/${orderId}/status`, {
        method: 'PUT',
        body,
      });
      Alert.alert('Succès', response.message);
      setModalVisible(false); // Fermer la modale si ouverte
      fetchOrders(); // Recharger les commandes
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le statut');
    }
  };

  const handleReturnToPending = (orderId) => {
    setSelectedOrderId(orderId);
    setModalVisible(true);
  };

  const renderProduct = ({ item, orderId }) => {
    const isChecked = checkedProducts[orderId]?.[item._id] || false;

    return (
      <View style={[styles.productCard, isChecked ? styles.productCardChecked : null]}>
        <View style={styles.productDetails}>
          <Text style={styles.productName}>{item.productId?.name || 'Produit inconnu'}</Text>
          <Text style={styles.productQuantity}>Quantité: {item.quantity}</Text>
        </View>
        <TouchableOpacity onPress={() => toggleProductCheck(orderId, item._id, !isChecked)}>
          <View style={styles.checkboxContainer}>
            <View style={[styles.checkbox, isChecked ? styles.checked : null]} />
            <Text style={styles.checkboxLabel}>{isChecked ? 'Coché' : 'Cocher'}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderOrder = () => {
    if (orders.length === 0) {
      return <Text style={styles.noOrders}>Aucune commande à traiter</Text>;
    }

    const currentOrder = orders[0]; // Prendre la commande la plus ancienne
    const checkedCount = Object.values(checkedProducts[currentOrder._id] || {}).filter(Boolean).length;
    const totalProducts = currentOrder.products.length;
    const allChecked = checkedCount === totalProducts;

    return (
      <Animated.View style={[styles.orderCard, { opacity: fadeAnim, backgroundColor: allChecked ? '#e6f4ea' : '#fff3e0' }]}>
        <Text style={styles.orderTitle}>Commande de {currentOrder.clientId?.name || 'Inconnu'}</Text>
        <Text style={styles.orderText}>Total: {currentOrder.totalAmount} FCFA</Text>
        <Text style={styles.orderText}>Adresse: {currentOrder.deliveryAddress?.address}</Text>
        <Text style={styles.progressText}>{`${checkedCount}/${totalProducts} produits cochés`}</Text>
        <FlatList
          data={currentOrder.products}
          renderItem={({ item }) => renderProduct({ item, orderId: currentOrder._id })}
          keyExtractor={(product) => product._id}
          style={styles.productList}
          ItemSeparatorComponent={() => <View style={styles.productSeparator} />}
        />
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: allChecked ? '#28a745' : '#a3d3a3' }]}
            onPress={() => updateOrderStatus(currentOrder._id, currentOrder.status === 'awaiting_validator' ? 'pending_validation' : 'validated')}
            disabled={!allChecked}
          >
            <Text style={styles.actionButtonText}>Valider</Text>
          </TouchableOpacity>
          {currentOrder.status === 'pending_validation' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#f1c40f' }]}
              onPress={() => handleReturnToPending(currentOrder._id)}
            >
              <Text style={styles.actionButtonText}>Hold</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#dc3545' }]}
            onPress={() => updateOrderStatus(currentOrder._id, 'cancelled')}
          >
            <Text style={styles.actionButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  if (isAvailable === null || !token) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#007bff" /></View>;
  }

  const pendingCount = orders.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.switchContainer}>
          <Text style={styles.status}>Disponibilité: </Text>
          <Switch
            value={isAvailable}
            onValueChange={(newValue) => toggleAvailability(newValue)}
            trackColor={{ false: '#dc3545', true: '#28a745' }}
            thumbColor={isAvailable ? '#fff' : '#fff'}
          />
          <Text style={styles.status}>{isAvailable ? 'ON' : 'OFF'}</Text>
        </View>
        <View style={styles.counterContainer}>
          <Text style={styles.counterText}>🔔 {pendingCount}</Text>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : renderOrder()}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pourquoi remettre en attente ?</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => updateOrderStatus(selectedOrderId, 'awaiting_validator', 'Problème de stock')}
            >
              <Text style={styles.modalButtonText}>Problème de stock</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => updateOrderStatus(selectedOrderId, 'awaiting_validator', 'Client injoignable')}
            >
              <Text style={styles.modalButtonText}>Client injoignable</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => updateOrderStatus(selectedOrderId, 'awaiting_validator', 'Erreur dans la commande')}
            >
              <Text style={styles.modalButtonText}>Erreur dans la commande</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#dc3545' }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop:20,
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  status: {
    fontSize: 16,
    marginHorizontal: 8,
    color: '#2c3e50',
  },
  counterContainer: {
    backgroundColor: '#3498db',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  counterText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  orderCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  orderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  orderText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#34495e',
    fontWeight: '500',
  },
  progressText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 10,
    fontWeight: '600',
  },
  productList: {
    marginBottom: 15,
    maxHeight: 300, // Limiter la hauteur pour éviter un scroll excessif
  },
  productSeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 5,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginVertical: 5,
  },
  productCardChecked: {
    backgroundColor: '#f0fff0',
    borderColor: '#28a745',
    borderWidth: 1,
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
  },
  checkboxContainer: {
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    marginBottom: 5,
  },
  checked: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noOrders: {
    fontSize: 16,
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  modalButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginVertical: 5,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});