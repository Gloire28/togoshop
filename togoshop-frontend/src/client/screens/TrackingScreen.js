import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { getOrderDetails } from '../../shared/services/api';

export default function TrackingScreen({ navigation, route }) {
  const [orders, setOrders] = useState(route.params?.orders || []);
  const [passedOrderId] = useState(route.params?.orderId);
  const [storedOrderId, setStoredOrderId] = useState(passedOrderId || null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('Params initiaux dans TrackingScreen:', route.params);
    console.log('Orders reçus:', orders, 'PassedOrderId:', passedOrderId);
    if (orders.length > 0) {
      const latestOrder = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      setStoredOrderId(latestOrder._id);
      
      setOrder(prevOrder => ({
        ...prevOrder,
        createdAt: latestOrder.createdAt,
      }));
    } else if (!passedOrderId) {
      console.log('Aucune commande ou orderId reçu, vérification en cours...');
      Alert.alert('Erreur', 'Aucune commande trouvée. Redirection...', [
        { text: 'OK', onPress: () => navigation.navigate('Home') }
      ]);
    }
  }, [route.params, orders, passedOrderId]);

  useEffect(() => {
    let isMounted = true;
    const fetchOrderDetails = async () => {
      if (!storedOrderId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getOrderDetails(storedOrderId);
        if (isMounted) {
          
          const initialOrder = orders.find(order => order._id === storedOrderId) || {};
          setOrder({
            ...initialOrder, 
            ...data.order,   
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
            if (orders.length > 0) {
              const latestOrder = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
              setStoredOrderId(latestOrder._id);
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
            if (orders.length > 0) {
              const latestOrder = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
              setStoredOrderId(latestOrder._id);
            }
          }}
          color="#4A90E2"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suivi de la Livraison</Text>
      <View style={styles.trackingInfo}>
        {order && (
          <>
            <Text style={styles.infoText}>Commande ID: {order._id}</Text>
            <Text style={styles.infoText}>Adresse: {order.deliveryAddress?.address || 'Non disponible'}</Text>
            <Text style={styles.infoText}>Statut: {order.status ? order.status.replace(/_/g, ' ').toLowerCase() : 'Inconnu'}</Text>
            {order.status === 'pending_validation' && (
              <Text style={styles.infoText}>Position dans la file: {order.queuePosition || 'Non disponible'}</Text>
            )}
            <Text style={styles.infoText}>Total: {order.totalAmount || 0} XOF</Text>
            <Text style={styles.infoText}>
              Dernière mise à jour: {order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Non disponible'}
            </Text>
          </>
        )}
      </View>
      <Button title="Retour à l'Accueil" onPress={() => navigation.navigate('Home')} color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  trackingInfo: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 5, borderWidth: 1, borderColor: '#ddd', marginBottom: 20 },
  infoText: { fontSize: 16, marginVertical: 5 },
  errorText: { fontSize: 16, color: 'red', textAlign: 'center', marginBottom: 20 },
});