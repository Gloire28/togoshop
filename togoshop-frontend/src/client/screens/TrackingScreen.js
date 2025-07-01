import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Animated, TouchableOpacity } from 'react-native';
import { getOrderDetails, cancelOrder } from '../../shared/services/api';

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

  const handleCancelOrder = async () => {
    if (!order || !['awaiting_validator', 'pending_validation'].includes(order.status)) {
      Alert.alert('Erreur', 'Annulation possible uniquement pour les commandes en attente de validation ou en attente de validateur.');
      return;
    }
    Alert.alert(
      'Annuler la Commande',
      'Êtes-vous sûr de vouloir annuler cette commande ?',
      [
        { text: 'Non', style: 'cancel' },
        { text: 'Oui', onPress: async () => {
          try {
            await cancelOrder(orderId);
            Alert.alert('Succès', 'Commande annulée avec succès.');
            navigation.navigate('ProfileStack');
          } catch (error) {
            Alert.alert('Erreur', `Échec de l'annulation: ${error.message}`);
          }
        }},
      ]
    );
  };

  // Nouveau : Fonction pour générer le message de statut
  const renderStatusMessage = () => {
    if (!order) return null;
    
    switch (order.status) {
      case 'awaiting_validator':
        return (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTextStatus}>
              Aucun manager n'est actuellement disponible pour ce site. Veuillez patienter ou consulter un autre site.
            </Text>
          </View>
        );
      
      case 'pending_validation':
        return (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTextStatus}>
              Votre commande est en cours de validation par le manager. Veuillez patienter.
            </Text>
          </View>
        );
      
      case 'validated':
        return (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTextStatus}>
              Votre commande est prête. Le livreur vous l'apportera très bientôt.
            </Text>
          </View>
        );
      
      case 'in_delivery':
        return (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTextStatus}>
              Le livreur est en route vers votre adresse de livraison.
            </Text>
          </View>
        );
      
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Suivi de la Livraison</Text>
        <TouchableOpacity style={styles.loadingButton} onPress={() => {}}>
          <Text style={styles.buttonText}>Chargement...</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Erreur</Text>
        <Text style={styles.errorText}>{error || 'Aucune commande trouvée.'}</Text>
        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('ProfileStack')}>
          <Text style={styles.buttonText}>Retour à l'Accueil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.title}>Suivi de la Livraison</Text>
      
      {/* Nouveau : Affichage du message de statut */}
      {renderStatusMessage()}
      
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
              <Text style={styles.errorText}>Le code de validation n'est pas disponible. Veuillez contacter le support.</Text>
            ) : (
              <Text style={styles.validationCodeInstruction}>
                Veuillez partager ce code avec le livreur pour confirmer la livraison.
              </Text>
            )}
          </View>
        )}
      </View>
      
      <TouchableOpacity 
        style={styles.cancelButton} 
        onPress={handleCancelOrder} 
        disabled={!['awaiting_validator', 'pending_validation'].includes(order.status)}
      >
        <Text style={styles.buttonText}>Annuler la Commande</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('ProfileStack')}>
        <Text style={styles.buttonText}>Retour à l'Accueil</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    justifyContent: 'center', 
    backgroundColor: '#f5f5f5' 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    textAlign: 'center', 
    color: '#2c3e50' 
  },
  trackingInfo: { 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#ddd', 
    marginBottom: 20, 
    elevation: 2 
  },
  infoText: { 
    fontSize: 16, 
    marginVertical: 8, 
    color: '#34495e' 
  },
  errorText: { 
    fontSize: 14, 
    color: '#e74c3c', 
    textAlign: 'center', 
    marginTop: 5 
  },
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
  cancelButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 10,
    elevation: 3,
    alignItems: 'center',
  },
  homeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 10,
    elevation: 3,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  alertContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ef5350',
  },
  alertText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
  },
  loadingButton: {
    backgroundColor: '#bdc3c7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 10,
    elevation: 3,
    alignItems: 'center',
  },
  // Nouveaux styles pour les messages de statut
  infoContainer: {
    backgroundColor: '#e8f4f8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  infoTextStatus: {
    fontSize: 16,
    textAlign: 'center',
    color: '#2c3e50',
    fontWeight: '500',
  },
});