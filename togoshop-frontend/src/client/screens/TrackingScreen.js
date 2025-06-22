import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, Animated } from 'react-native';
import { getOrderDetails } from '../../shared/services/api';

export default function TrackingScreen({ navigation, route }) {
  const [orders, setOrders] = useState(route.params?.orders || []);
  const [passedOrderId] = useState(route.params?.orderId);
  const [storedOrderId, setStoredOrderId] = useState(passedOrderId || null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('Params initiaux dans TrackingScreen:', route.params);
    console.log('Orders reçus:', orders, 'PassedOrderId:', passedOrderId);
    let orderIdToUse = passedOrderId;
    if (!orderIdToUse && orders.length > 0) {
      const latestOrder = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      orderIdToUse = latestOrder._id;
    } else if (!orderIdToUse) {
      console.log('Aucune commande ou orderId reçu, vérification en cours...');
      Alert.alert('Erreur', 'Aucune commande trouvée. Redirection...', [
        { text: 'OK', onPress: () => navigation.navigate('Home') }
      ]);
      return;
    }
    setStoredOrderId(orderIdToUse);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [route.params, orders, passedOrderId]);

  useEffect(() => {
    let isMounted = true;
    const fetchOrderDetails = async () => {
      if (!storedOrderId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getOrderDetails(storedOrderId);
        console.log('Données reçues de getOrderDetails:', data); // Log pour déboguer
        if (isMounted) {
          const initialOrder = orders.find(order => order._id === storedOrderId) || {};
          console.log('InitialOrder:', initialOrder); // Log pour vérifier validationCode dans orders
          setOrder({
            ...initialOrder,
            ...data.order,
            validationCode: initialOrder.validationCode || data.order?.validationCode || 'Non disponible', // Priorité à initialOrder
          });
        }
      } catch (error) {
        if (isMounted) setError('Impossible de charger les détails de la commande.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrderDetails();

    return () => { isMounted = false; };
  }, [storedOrderId, orders]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Suivi de la Livraison</Text>
        <Text>Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Erreur</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Retour à l'Accueil" onPress={() => navigation.navigate('Home')} color="#007AFF" />
        <Button
          title="Recharger"
          onPress={() => {
            if (orders.length > 0 || passedOrderId) {
              const orderIdToUse = passedOrderId || [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]._id;
              setStoredOrderId(orderIdToUse);
            }
          }}
          color="#4A90E2"
        />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Suivi de la Livraison</Text>
        <Text>Aucune commande chargée.</Text>
        <Button
          title="Recharger"
          onPress={() => {
            if (orders.length > 0 || passedOrderId) {
              const orderIdToUse = passedOrderId || [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]._id;
              setStoredOrderId(orderIdToUse);
            }
          }}
          color="#4A90E2"
        />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.title}>Suivi de la Livraison</Text>
      <View style={styles.trackingInfo}>
        {order && (
          <>
            <Text style={styles.infoText}>Numéro de commande: {order.orderNumber || order._id}</Text>
            <Text style={styles.infoText}>Adresse: {order.deliveryAddress?.address || 'Non disponible'}</Text>
            <Text style={styles.infoText}>Statut: {order.status ? order.status.replace(/_/g, ' ').toLowerCase() : 'Inconnu'}</Text>
            {order.status === 'pending_validation' && (
              <Text style={styles.infoText}>Position dans la file: {order.queuePosition || 'Non disponible'}</Text>
            )}
            <Text style={styles.infoText}>Total: {order.totalAmount || 0} FCFA</Text>
            <Text style={styles.infoText}>
              Dernière mise à jour: {order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Non disponible'}
            </Text>
            {(order.status === 'in_delivery' || order.status === 'ready_for_pickup') && (
              <View style={styles.validationCodeContainer}>
                <Text style={styles.validationCodeLabel}>Code de validation pour le livreur :</Text>
                <Text style={styles.validationCode}>{order.validationCode || 'Non disponible'}</Text>
                {order.validationCode === 'Non disponible' ? (
                  <Text style={styles.errorText}>Le code de validation n’est pas disponible. Veuillez contacter le support.</Text>
                ) : (
                  <Text style={styles.validationCodeInstruction}>
                    Veuillez partager ce code avec le livreur pour confirmer la livraison.
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </View>
      <Button title="Retour à l'Accueil" onPress={() => navigation.navigate('Home')} color="#007AFF" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#2c3e50' },
  trackingInfo: { backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', marginBottom: 20, elevation: 2 },
  infoText: { fontSize: 16, marginVertical: 8, color: '#34495e' },
  errorText: { fontSize: 14, color: '#e74c3c', textAlign: 'center', marginTop: 5 },
  validationCodeContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3498db',
    alignItems: 'center',
  },
  validationCodeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 5,
  },
  validationCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
    letterSpacing: 2,
    marginBottom: 5,
  },
  validationCodeInstruction: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
});