import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSupermarketStatus,
  toggleSupermarketStatus,
} from '../../shared/services/api';
import { AppContext } from '../../shared/context/AppContext';

export default function DashboardScreen({ navigation }) {
  const { user, refreshData } = useContext(AppContext);
  const [supermarketStatus, setSupermarketStatus] = useState(null);
  const [loading, setLoading] = useState({
    auth: true,
    status: true,
  });
  const [closureReason, setClosureReason] = useState('');
  const [isReasonModalVisible, setIsReasonModalVisible] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const MAX_RETRIES = 5;

  const isManager = user?.roles?.some(role =>
    ['manager', 'order_validator', 'stock_manager'].includes(role)
  );

  useEffect(() => {
    let isMounted = true;
    const animation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]);

    const loadSupermarketStatus = async () => {
      try {
        if (!user && retryCount < MAX_RETRIES) {
          console.log('Refresh attempt:', retryCount);
          await refreshData?.();
          setRetryCount(prev => prev + 1);
          return;
        }

        if (!user?._id || !user.roles?.length) {
          if (isMounted) setLoading(prev => ({ ...prev, auth: false }));
          return;
        }

        const token = await AsyncStorage.getItem('token');
        if (!token || !user.supermarketId?._id) {
          Alert.alert('Erreur', 'Aucun supermarché associé ou token manquant.');
          if (isMounted) setLoading(prev => ({ ...prev, auth: false }));
          return;
        }

        const status = await getSupermarketStatus(user.supermarketId._id);
        if (isMounted) setSupermarketStatus(status);
      } catch (err) {
        Alert.alert('Erreur', `Impossible de charger le statut: ${err.message}`);
      } finally {
        if (isMounted) setLoading(prev => ({ auth: false, status: false }));
      }
    };

    animation.start();
    loadSupermarketStatus();

    return () => {
      isMounted = false;
      animation.stop();
    };
  }, [user, refreshData, retryCount]);

  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const handleToggleStatus = async () => {
    if (!isManager) {
      Alert.alert('Accès refusé', 'Seuls les managers peuvent modifier l\'état.');
      return;
    }

    if (!user.supermarketId?._id) {
      Alert.alert('Erreur', 'Aucun supermarché associé.');
      return;
    }

    const currentStatus = supermarketStatus?.status;
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    if (['closed', 'maintenance'].includes(newStatus) && !closureReason) {
      setIsReasonModalVisible(true);
      return;
    }

    try {
      setLoading(prev => ({ ...prev, status: true }));
      
      await toggleSupermarketStatus(user.supermarketId._id, {
        status: newStatus,
        reason: ['closed', 'maintenance'].includes(newStatus) ? closureReason : undefined,
      });

      const updatedStatus = await getSupermarketStatus(user.supermarketId._id);
      setSupermarketStatus(updatedStatus);
      setClosureReason('');
      Alert.alert('Succès', `Supermarché ${newStatus === 'open' ? 'ouvert' : newStatus === 'closed' ? 'fermé' : 'en maintenance'}.`);
    } catch (err) {
      Alert.alert('Erreur', `Échec du basculement: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, status: false }));
    }
  };

  if (loading.auth) {
    return (
      <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!user?._id || !isManager) {
    return (
      <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Accès refusé</Text>
          <Text style={styles.subtitle}>Cet écran est réservé aux managers.</Text>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Tableau de Bord Manager</Text>
        <Text style={styles.subtitle}>Le centre de commande</Text>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
        >
          <Ionicons name="log-out" size={30} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {loading.status ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>Chargement du statut...</Text>
        </View>
      ) : (
        <Animated.View style={[styles.statusContainer, { opacity: fadeAnim }]}>
          <Text style={styles.statusText}>
            État du supermarché :{' '}
            {supermarketStatus?.status === 'open'
              ? 'Ouvert'
              : supermarketStatus?.status === 'closed'
              ? `Fermé (${supermarketStatus?.closureReason || 'Sans raison'})`
              : `En maintenance (${supermarketStatus?.closureReason || 'Sans raison'})`}
          </Text>
          <TouchableOpacity
            style={[
              styles.toggleButton, 
              { backgroundColor: supermarketStatus?.status === 'open' ? '#ff4444' : '#00cc00' }
            ]}
            onPress={handleToggleStatus}
          >
            <Text style={styles.toggleButtonText}>
              {supermarketStatus?.status === 'open' ? 'Fermer' : 'Ouvrir'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <Animated.View 
        style={[
          styles.cardsContainer, 
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        {[
          { icon: 'list', title: 'Commandes', description: 'Traiter et valider les commandes', screen: 'Orders' },
          { icon: 'cube', title: 'Produits', description: 'Ajouter ou modifier des produits', screen: 'Products' },
          { icon: 'archive', title: 'Stocks', description: 'Mettre à jour les stocks', screen: 'Stock' },
          { icon: 'time', title: 'Historique', description: 'Voir les commandes terminées', screen: 'OrderHistory' },
        ].map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.card}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={item.icon} size={30} color="#fff" />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Bouton Gérer les Promotions */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('Promotion')}
      >
        <Ionicons name="pricetag" size={24} color="#fff" />
        <Text style={styles.createButtonText}>Gérer les Promotions</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isReasonModalVisible}
        onRequestClose={() => setIsReasonModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Raison de la fermeture</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Entrez la raison (ex. Inventaire)"
              value={closureReason}
              onChangeText={setClosureReason}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsReasonModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={() => {
                  setIsReasonModalVisible(false);
                  handleToggleStatus();
                }}
              >
                <Text style={styles.modalButtonText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 25, paddingTop: 60, paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 40, position: 'relative' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: 16, color: '#d1d8e0', marginTop: 5, fontStyle: 'italic' },
  cardsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 5 },
  cardDescription: { fontSize: 14, color: '#d1d8e0', textAlign: 'center' },
  logoutButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  modalContainer: {
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
  },
  modalConfirmButton: {
    backgroundColor: '#007bff',
  },
  modalButtonText: {
    color: '#333',
    fontSize: 16,
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#1abc9c',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
    fontWeight: 'bold',
  },
});