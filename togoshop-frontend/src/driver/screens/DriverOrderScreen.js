import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { getDriverOrders, acceptOrder, rejectOrder, updateDriverOrderStatus, reportDeliveryIssue } from '../../shared/services/api';
import { AppContext } from '../../shared/context/AppContext';

const DriverOrderScreen = ({ navigation }) => {
  const { fetchCart } = useContext(AppContext); // Ajout pour synchronisation si nécessaire
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const loadLocationAndOrders = async () => {
      console.log('useEffect démarré pour charger localisation et commandes');
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission de localisation refusée');
        Alert.alert('Erreur', 'Permission de localisation refusée. Utilisation de coordonnées par défaut.');
        setCurrentLocation({ latitude: 6.1700, longitude: 1.2300 });
      } else {
        try {
          let userLocation = await Location.getCurrentPositionAsync({});
          setCurrentLocation({
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
          });
          console.log('Localisation obtenue:', userLocation.coords);
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: userLocation.coords.latitude,
              longitude: userLocation.coords.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            });
          }
        } catch (error) {
          console.error('Erreur de localisation:', error.message);
          Alert.alert('Erreur', 'Impossible de récupérer la localisation. Coordonnées par défaut utilisées.');
          setCurrentLocation({ latitude: 6.1700, longitude: 1.2300 });
        }
      }

      await fetchOrders();
    };
    loadLocationAndOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await getDriverOrders();
      console.log('Données reçues par fetchOrders:', response);
      const filteredOrders = (response || []).filter(order => order.status !== 'delivered');
      setOrders(filteredOrders);
    } catch (error) {
      console.error('Erreur API:', error.message);
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

  const markAsInDelivery = async (orderId) => {
    try {
      await updateDriverOrderStatus(orderId, 'in_delivery');
      Alert.alert('Succès', 'Commande marquée comme en livraison');
      fetchOrders();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    }
  };

  const markAsDelivered = (orderId) => {
    navigation.navigate('DriverValidation', { orderId });
  };

  const reportDeliveryIssueHandler = async (orderId, issueDetails) => {
    try {
      await reportDeliveryIssue(orderId, issueDetails || 'Problème non spécifié');
      Alert.alert('Succès', 'Problème signalé avec succès');
      fetchOrders();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de signaler le problème');
    }
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  };

  const estimateTime = (distance) => {
    const speed = 40;
    const timeInMinutes = (distance / speed) * 60;
    return Math.max(1, Math.round(timeInMinutes));
  };

  const getDirection = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 'Inconnue';
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    if (dLat > 0 && dLng > 0) return 'Nord-est';
    if (dLat > 0 && dLng < 0) return 'Nord-ouest';
    if (dLat < 0 && dLng > 0) return 'Sud-est';
    if (dLat < 0 && dLng < 0) return 'Sud-ouest';
    if (dLat > 0 && dLng === 0) return 'Nord';
    if (dLat < 0 && dLng === 0) return 'Sud';
    if (dLat === 0 && dLng > 0) return 'Est';
    if (dLat === 0 && dLng < 0) return 'Ouest';
    return 'Inconnue';
  };

  const renderOrder = ({ item }) => {
    const statusStyles = {
      validated: { backgroundColor: '#FCD34D', icon: 'clock', label: 'Assignée' },
      ready_for_pickup: { backgroundColor: '#60A5FA', icon: 'cart', label: 'Prête' },
      in_delivery: { backgroundColor: '#34D399', icon: 'car', label: 'En livraison' },
      delivered: { backgroundColor: '#A3BFFA', icon: 'checkmark', label: 'Livré' },
    };

    const status = statusStyles[item.status] || { backgroundColor: '#9CA3AF', icon: 'help', label: 'Inconnu' };
    const supermarketLocation = item.supermarketId?.locations?.find(loc => loc._id === item.locationId);
    const supermarketAddress = supermarketLocation?.address || 'Adresse non définie';
    const supermarketLat = supermarketLocation?.latitude;
    const supermarketLng = supermarketLocation?.longitude;
    const deliveryLat = item.deliveryAddress?.lat;
    const deliveryLng = item.deliveryAddress?.lng;

    let distance = 0, direction = 'Inconnue', estimatedTime = '', destinationLat = null, destinationLng = null;
    if (currentLocation) {
      if (item.status === 'ready_for_pickup' && supermarketLat && supermarketLng) {
        distance = calculateDistance(currentLocation.latitude, currentLocation.longitude, supermarketLat, supermarketLng);
        direction = getDirection(currentLocation.latitude, currentLocation.longitude, supermarketLat, supermarketLng);
        estimatedTime = `Temps estimé : ${estimateTime(distance)} min`;
        destinationLat = supermarketLat;
        destinationLng = supermarketLng;
      } else if (item.status === 'in_delivery' && deliveryLat && deliveryLng) {
        distance = calculateDistance(currentLocation.latitude, currentLocation.longitude, deliveryLat, deliveryLng);
        direction = getDirection(currentLocation.latitude, currentLocation.longitude, deliveryLat, deliveryLng);
        estimatedTime = `Temps estimé : ${estimateTime(distance)} min`;
        destinationLat = deliveryLat;
        destinationLng = deliveryLng;
      }
    }

    const retrievalText = `Récupération : ${item.supermarketId?.name || 'Supermarché Inconnu'} (${supermarketAddress}${distance > 0 ? `, ~${distance} km, ${direction}` : ''})`;

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}># {item._id.substring(0, 8)}...</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.backgroundColor }]}>
            <Ionicons name={status.icon} size={14} color="#fff" />
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>
        <View style={styles.orderDetails}>
          <Text style={styles.orderText}><Ionicons name="location" size={16} color="#4B5563" /> {item.deliveryAddress?.address || 'Adresse non définie'} {item.deliveryAddress?.instructions ? ` (${item.deliveryAddress.instructions})` : ''}</Text>
          <Text style={styles.orderText}><Ionicons name="cash" size={16} color="#4B5563" /> Paiement: {item.paymentMethod || 'Non défini'}</Text>
          <Text style={styles.orderText}><Ionicons name="car" size={16} color="#4B5563" /> Frais: {item.deliveryFee} FCFA</Text>
          <Text style={styles.orderText}><Ionicons name="person" size={16} color="#4B5563" /> {item.clientId?.name || item.clientId?.email || 'Client Inconnu'}</Text>
          <Text style={styles.orderText}><Ionicons name="store" size={16} color="#4B5563" /> {retrievalText}</Text>
          {estimatedTime && <Text style={styles.orderText}>{estimatedTime}</Text>}
        </View>
        {(item.status === 'ready_for_pickup' || item.status === 'in_delivery') && currentLocation && (
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              onError={(error) => console.log('Erreur MapView:', error)}
            >
              <Marker coordinate={currentLocation} title="Votre position" pinColor="#34D399" />
              {destinationLat && destinationLng && (
                <Marker coordinate={{ latitude: destinationLat, longitude: destinationLng }} title={item.status === 'ready_for_pickup' ? 'Supermarché' : 'Adresse de livraison'} pinColor="#60A5FA" />
              )}
            </MapView>
          </View>
        )}
        <View style={styles.actionContainer}>
          {item.status === 'validated' && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={() => acceptOrderHandler(item._id)}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.buttonText}>Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => rejectOrderHandler(item._id)}>
                <Ionicons name="close" size={16} color="#fff" />
                <Text style={styles.buttonText}>Rejeter</Text>
              </TouchableOpacity>
            </View>
          )}
          {item.status === 'ready_for_pickup' && (
            <TouchableOpacity style={[styles.actionButton, styles.inDeliveryButton]} onPress={() => markAsInDelivery(item._id)}>
              <Ionicons name="car" size={16} color="#fff" />
              <Text style={styles.buttonText}>Marquer comme En Livraison</Text>
            </TouchableOpacity>
          )}
          {item.status === 'in_delivery' && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionButton, styles.deliveredButton]} onPress={() => markAsDelivered(item._id)}>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.buttonText}>Valider la Livraison</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.reportButton]} onPress={() => Alert.prompt('Signaler un Problème', 'Décrivez le problème', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Envoyer', onPress: (issueDetails) => reportDeliveryIssueHandler(item._id, issueDetails || 'Problème non spécifié') },
              ], 'plain-text')}>
                <Ionicons name="alert" size={16} color="#fff" />
                <Text style={styles.buttonText}>Signaler</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mes Commandes</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#4B5563" style={styles.loader} />
        ) : orders.length === 0 ? (
          <View style={styles.noOrdersContainer}>
            <Ionicons name="cart" size={60} color="#D1D5DB" />
            <Text style={styles.noOrdersText}>Aucune commande en cours</Text>
          </View>
        ) : (
          <FlatList data={orders} renderItem={renderOrder} keyExtractor={(item) => item._id} contentContainerStyle={styles.orderList} />
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 50 },
  header: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  loader: { flex: 1, justifyContent: 'center' },
  orderList: { paddingBottom: 20 },
  orderCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 16 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  orderDetails: { marginBottom: 12 },
  orderText: { fontSize: 14, color: '#4B5563', marginBottom: 8 },
  actionContainer: { marginTop: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flex: 1, marginHorizontal: 4 },
  acceptButton: { backgroundColor: '#34D399' },
  rejectButton: { backgroundColor: '#F87171' },
  inDeliveryButton: { backgroundColor: '#60A5FA', width: '100%' },
  deliveredButton: { backgroundColor: '#34D399' },
  reportButton: { backgroundColor: '#F87171' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  noOrdersContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  noOrdersText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  mapContainer: { height: 150, marginBottom: 12, borderRadius: 10, overflow: 'hidden' },
  map: { ...StyleSheet.absoluteFillObject },
});
export default DriverOrderScreen;
