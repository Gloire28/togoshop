import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, Animated } from 'react-native';
import { getOrderDetails } from '../../shared/services/api';

export default function TrackingScreen({ navigation, route }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const { orderId } = route.params || {};

  useEffect(() => {
    console.log('TrackingScreen mounted with orderId:', orderId, 'Key:', route.key);
    if (!orderId) {
      Alert.alert('Erreur', 'Aucune commande sélectionnée. Redirection...', [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
      return;
    }

    setOrder(null);
    setError(null);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    return () => {
      console.log('TrackingScreen unmounted with orderId:', orderId);
    };
  }, [orderId]);

  useEffect(() => {
    let isMounted = true;
    const fetchOrderDetails = async () => {
      if (!orderId) return;
      setLoading(true);
      setError(null);
      try {
        console.log(`Fetching order details for orderId: ${orderId} at ${new Date().toISOString()}`);
        const data = await getOrderDetails(orderId);
        if (isMounted) setOrder(data.order);
      } catch (error) {
        if (isMounted) setError(`Impossible de charger les détails: ${error.message}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrderDetails();

    return () => { isMounted = false; };
  }, [orderId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Suivi de la Livraison</Text>
        <Text>Chargement...</Text>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Erreur</Text>
        <Text style={styles.errorText}>{error || 'Aucune commande trouvée.'}</Text>
        <Button title="Retour à l'Accueil" onPress={() => navigation.navigate('ProfileStack')} color="#007AFF" />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.title}>Suivi de la Livraison</Text>
      <View style={styles.trackingInfo}>
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
      </View>
      <Button title="Retour à l'Accueil" onPress={() => navigation.navigate('ProfileStack')} color="#007AFF" />
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