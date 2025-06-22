import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getDriverOrders, acceptOrder, rejectOrder, updateDriverOrderStatus, reportDeliveryIssue } from '../../shared/services/api';

export default function DriverOrderScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentLocation] = useState({ lat: 6.1700, lng: 1.2300 }); // Position simulée (ex. Lomé)

  useEffect(() => {
    console.log('useEffect appelé pour fetchOrders');
    fetchOrders();

    // Simulation de mise à jour toutes les 2 minutes
    const locationInterval = setInterval(() => {
      console.log('Mise à jour simulée de la position toutes les 2 minutes');
    }, 120000); // 2 minutes

    return () => clearInterval(locationInterval);
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await getDriverOrders();
      console.log('Données reçues par fetchOrders:', response);
      // Exclure explicitement les commandes delivered
      const filteredOrders = (response || []).filter(order => order.status !== 'delivered');
      setOrders(filteredOrders);
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
      await reportDeliveryIssue(orderId, issueDetails);
      Alert.alert('Succès', 'Problème signalé avec succès');
      fetchOrders();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de signaler le problème');
    }
  };

  // Fonction pour calculer la distance euclidienne (en km)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 0;

    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance en km
    return distance.toFixed(2); // Arrondi à 2 décimales
  };

  // Fonction pour estimer le temps d’arrivée (vitesse = 40 km/h)
  const estimateTime = (distance) => {
    const speed = 40; // Vitesse moyenne en km/h
    const timeInHours = distance / speed; // Temps en heures
    const timeInMinutes = timeInHours * 60; // Temps en minutes
    return Math.max(1, Math.round(timeInMinutes)); // Minimum 1 minute
  };

  // Fonction pour déterminer la direction
  const getDirection = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 'Inconnue';

    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;

    if (dLat > 0 && dLng > 0) return 'Vers le nord-est';
    if (dLat > 0 && dLng < 0) return 'Vers le nord-ouest';
    if (dLat < 0 && dLng > 0) return 'Vers le sud-est';
    if (dLat < 0 && dLng < 0) return 'Vers le sud-ouest';
    if (dLat > 0 && dLng === 0) return 'Vers le nord';
    if (dLat < 0 && dLng === 0) return 'Vers le sud';
    if (dLat === 0 && dLng > 0) return 'Vers l’est';
    if (dLat === 0 && dLng < 0) return 'Vers l’ouest';
    return 'Inconnue';
  };

  const renderOrder = ({ item }) => {
    console.log('Rendu de l\'ordre:', item); // Débogage pour vérifier le statut
    const statusStyles = {
      validated: { backgroundColor: '#FCD34D', icon: 'clock-outline', label: 'Assignée' },
      ready_for_pickup: { backgroundColor: '#60A5FA', icon: 'package-variant', label: 'Prête' },
      in_delivery: { backgroundColor: '#34D399', icon: 'truck-delivery', label: 'En livraison' },
      delivered: { backgroundColor: '#A3BFFA', icon: 'check-circle', label: 'Livré' },
    };

    const status = statusStyles[item.status] || { backgroundColor: '#9CA3AF', icon: 'help-circle', label: 'Inconnu' };

    // Trouver l'adresse et les coordonnées du supermarché via locationId
    const supermarketLocation = item.supermarketId?.locations?.find(loc => loc._id === item.locationId);
    const supermarketAddress = supermarketLocation?.address || 'Adresse non définie';
    const supermarketLat = supermarketLocation?.latitude;
    const supermarketLng = supermarketLocation?.longitude;

    // Coordonnées de livraison
    const deliveryLat = item.deliveryAddress?.lat;
    const deliveryLng = item.deliveryAddress?.lng;

    // Calcul de la distance et direction selon le statut
    let distance = 0;
    let direction = 'Inconnue';
    let estimatedTime = '';

    if (currentLocation) {
      if (item.status === 'ready_for_pickup' && supermarketLat && supermarketLng) {
        distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          supermarketLat,
          supermarketLng
        );
        direction = getDirection(
          currentLocation.lat,
          currentLocation.lng,
          supermarketLat,
          supermarketLng
        );
        const time = estimateTime(distance);
        estimatedTime = `Temps estimé : ${time} min`;
      } else if (item.status === 'in_delivery' && deliveryLat && deliveryLng) {
        distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          deliveryLat,
          deliveryLng
        );
        direction = getDirection(
          currentLocation.lat,
          currentLocation.lng,
          deliveryLat,
          deliveryLng
        );
        const time = estimateTime(distance);
        estimatedTime = `Temps estimé : ${time} min`;
      }
    }

    // Affichage de la récupération avec distance et direction
    const retrievalText = item.status === 'ready_for_pickup' || item.status === 'in_delivery'
      ? `Récupération : ${item.supermarketId?.name || 'Supermarché Inconnu'} (${supermarketAddress}, ~${distance} km, ${direction})`
      : `Récupération : ${item.supermarketId?.name || 'Supermarché Inconnu'} (${supermarketAddress})`;

    return (
      <View style={styles.orderCard}>
        {/* En-tête avec ID et statut */}
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}># {item._id.substring(0, 8)}...</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.backgroundColor }]}>
            <Icon name={status.icon} size={14} color="#fff" style={styles.statusIcon} />
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>

        {/* Informations pour tous les statuts */}
        <View style={styles.orderDetails}>
          <Text style={styles.orderText}>
            <Icon name="map-marker" size={16} color="#4B5563" /> 
            {item.deliveryAddress?.address || 'Adresse non définie'} 
            {item.deliveryAddress?.instructions ? ` (${item.deliveryAddress.instructions})` : ''}
          </Text>
          <Text style={styles.orderText}>
            <Icon name="cash" size={16} color="#4B5563" /> Paiement: {item.paymentMethod || 'Non défini'}
          </Text>
          <Text style={styles.orderText}>
            <Icon name="truck" size={16} color="#4B5563" /> Frais: {item.deliveryFee} FCFA
          </Text>
          <Text style={styles.orderText}>
            <Icon name="account" size={16} color="#4B5563" /> {item.clientId?.name || item.clientId?.email || 'Client Inconnu'}
          </Text>
          <Text style={styles.orderText}>
            <Icon name="store" size={16} color="#4B5563" /> {retrievalText}
          </Text>
          {estimatedTime && <Text style={styles.orderText}>{estimatedTime}</Text>}
        </View>

        {/* Actions selon le statut */}
        <View style={styles.actionContainer}>
          {item.status === 'validated' && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => acceptOrderHandler(item._id)}
              >
                <Icon name="check" size={16} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => rejectOrderHandler(item._id)}
              >
                <Icon name="close" size={16} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Rejeter</Text>
              </TouchableOpacity>
            </View>
          )}
          {item.status === 'ready_for_pickup' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.inDeliveryButton]}
              onPress={() => markAsInDelivery(item._id)}
            >
              <Icon name="truck-delivery" size={16} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Marquer comme En Livraison</Text>
            </TouchableOpacity>
          )}
          {item.status === 'in_delivery' && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.deliveredButton]}
                onPress={() => markAsDelivered(item._id)}
              >
                <Icon name="check-circle" size={16} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Valider la Livraison</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.reportButton]}
                onPress={() =>
                  Alert.prompt(
                    'Signaler un Problème',
                    'Décrivez le problème',
                    [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Envoyer',
                        onPress: (issueDetails) => reportDeliveryIssueHandler(item._id, issueDetails || 'Problème non spécifié'),
                      },
                    ],
                    'plain-text'
                  )
                }
              >
                <Icon name="alert-circle" size={16} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Signaler</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Commandes</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#4B5563" style={styles.loader} />
      ) : orders.length === 0 ? (
        <View style={styles.noOrdersContainer}>
          <Icon name="package-variant-closed" size={60} color="#D1D5DB" />
          <Text style={styles.noOrdersText}>Aucune commande en cours</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.orderList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  header: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    fontFamily: 'Poppins-Bold',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  orderList: {
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: 'Poppins-SemiBold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
  orderDetails: {
    marginBottom: 12,
  },
  orderText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
    fontFamily: 'Poppins-Regular',
  },
  actionContainer: {
    marginTop: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: '#34D399',
  },
  rejectButton: {
    backgroundColor: '#F87171',
  },
  inDeliveryButton: {
    backgroundColor: '#60A5FA',
    width: '100%',
  },
  deliveredButton: {
    backgroundColor: '#34D399',
  },
  reportButton: {
    backgroundColor: '#F87171',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    marginLeft: 6,
  },
  buttonIcon: {
    marginRight: 6,
  },
  noOrdersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noOrdersText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    fontFamily: 'Poppins-Regular',
  },
});