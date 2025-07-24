import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../../shared/context/AppContext';
import { apiRequest, getUserOrders } from '../../shared/services/api';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental &&
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProfileScreen({ navigation }) {
  const { user, setUser } = useContext(AppContext);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isInfoVisible, setIsInfoVisible] = useState(false); // état pour dérouler la carte

  useEffect(() => {
    const fetchUserProfile = async () => {
      setProfileLoading(true);
      try {
        const data = await apiRequest('/users/me');
        setUser(data); 
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        await AsyncStorage.setItem('user', JSON.stringify(data));
      } catch (error) {
        console.log('Erreur lors de la récupération du profil:', error.message);
        Alert.alert('Erreur', error.message || 'Impossible de récupérer le profil');
      } finally {
        setProfileLoading(false);
      }
    };

    const fetchOrderHistory = async () => {
      setOrdersLoading(true);
      try {
        const data = await getUserOrders();
        setOrders(data || []);
      } catch (error) {
        console.log('Erreur lors de la récupération de l\'historique des commandes:', error.message);
      } finally {
        setOrdersLoading(false);
      }
    };

    if (!user) {
      const loadUserFromStorage = async () => {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setName(parsedUser.name || '');
          setEmail(parsedUser.email || '');
          setPhone(parsedUser.phone || '');
        }
      };
      loadUserFromStorage();
    }

    fetchUserProfile();
    fetchOrderHistory();
  }, [user?.id]);

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const updatedData = {};
      if (name) updatedData.name = name;
      if (email) updatedData.email = email;
      if (phone) updatedData.phone = phone;
      if (password) updatedData.password = password;

      const data = await apiRequest('/users/me', { method: 'PUT', body: updatedData });
      setUser(data);
      await AsyncStorage.setItem('user', JSON.stringify(data));
      setIsEditing(false);
      Alert.alert('Succès', 'Profil mis à jour avec succès');
    } catch (error) {
      console.log('Erreur lors de la mise à jour du profil:', error.message);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le profil');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setUser(null);
    navigation.navigate('Login');
  };

  const handleTrackOrder = (orderId) => {
    console.log('Navigating to Tracking with orderId:', orderId);
    navigation.push('TrackingStack', { orderId, key: `${orderId}-${Date.now()}` });
  };

  const toggleInfo = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsInfoVisible(!isInfoVisible);
  };

  return (
    <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
      <View style={styles.container}>
        <ScrollView>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Mon Profil</Text>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.editButton}>
              <Ionicons name={isEditing ? 'close' : 'pencil'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {profileLoading ? (
            <ActivityIndicator size="large" color="#fff" style={{ marginVertical: 20 }} />
          ) : (
            <>
              {/* Carte Informations Personnelles */}
              <TouchableOpacity style={styles.infoCard} onPress={toggleInfo}>
                <Text style={styles.infoCardText}>Informations Personnelles</Text>
                <Ionicons 
                  name={isInfoVisible ? 'chevron-up' : 'chevron-down'} 
                  size={24} 
                  color="#333" 
                />
              </TouchableOpacity>

              {isInfoVisible && (
                <View style={styles.profileCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Nom :</Text>
                    {isEditing ? (
                      <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Entrez votre nom"
                        placeholderTextColor="#A1A1AA"
                      />
                    ) : (
                      <Text style={styles.value}>{name || 'Non défini'}</Text>
                    )}
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Email :</Text>
                    {isEditing ? (
                      <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Entrez votre email"
                        placeholderTextColor="#A1A1AA"
                        keyboardType="email-address"
                      />
                    ) : (
                      <Text style={styles.value}>{email || 'N/A'}</Text>
                    )}
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Téléphone :</Text>
                    {isEditing ? (
                      <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Entrez votre numéro"
                        placeholderTextColor="#A1A1AA"
                        keyboardType="phone-pad"
                      />
                    ) : (
                      <Text style={styles.value}>{phone || 'Non défini'}</Text>
                    )}
                  </View>
                  {isEditing && (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Nouveau Mot de Passe :</Text>
                      <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Laissez vide pour ne pas changer"
                        placeholderTextColor="#A1A1AA"
                        secureTextEntry
                      />
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Compte créé le :</Text>
                    <Text style={styles.value}>
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Points de fidélité :</Text>
                    <Text style={styles.value}>{user?.loyaltyPoints || 0}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Code de parrainage :</Text>
                    <Text style={styles.value}>{user?.referralCode || 'Non défini'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Nombre de filleuls :</Text>
                    <Text style={styles.value}>{user?.referralCount || 0}</Text>
                  </View>
                  {isEditing && (
                    <TouchableOpacity
                      style={[styles.saveButton, loading && styles.disabledButton]}
                      onPress={handleUpdateProfile}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.buttonText}>Sauvegarder</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}

          {/* Historique des commandes */}
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Historique des Commandes</Text>
            {ordersLoading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : orders.length > 0 ? (
              orders.map((order) => {
                if (!order || !order._id) return null;
                return (
                  <View key={order._id} style={styles.orderCard}>
                    <View style={styles.orderRow}>
                      <Text style={styles.orderLabel}>Commande ID :</Text>
                      <Text style={styles.orderValue}>{order._id || 'N/A'}</Text>
                    </View>
                    <View style={styles.orderRow}>
                      <Text style={styles.orderLabel}>Date :</Text>
                      <Text style={styles.orderValue}>
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.orderRow}>
                      <Text style={styles.orderLabel}>Montant Total :</Text>
                      <Text style={styles.orderValue}>{order.totalAmount ? `${order.totalAmount} FCFA` : 'N/A'}</Text>
                    </View>
                    <View style={styles.orderRow}>
                      <Text style={styles.orderLabel}>Frais de Livraison :</Text>
                      <Text style={styles.orderValue}>{order.deliveryFee ? `${order.deliveryFee} FCFA` : 'N/A'}</Text>
                    </View>
                    <View style={styles.orderRow}>
                      <Text style={styles.orderLabel}>Nombre de Produits :</Text>
                      <Text style={styles.orderValue}>{order.products ? order.products.length : 'N/A'}</Text>
                    </View>
                    <View style={styles.orderRow}>
                      <Text style={styles.orderLabel}>Statut :</Text>
                      <Text
                        style={[styles.orderValue, { color: order.status === 'delivered' ? '#28a745' : '#e74c3c' }]}
                      >
                        {order.status === 'cart_in_progress' ? 'Panier en cours' : order.status || 'N/A'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.trackButton}
                      onPress={() => handleTrackOrder(order._id)}
                    >
                      <Text style={styles.trackButtonText}>Suivre</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <Text style={styles.noOrdersText}>Aucune commande passée</Text>
            )}
          </View>

          {/* Déconnexion */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.buttonText}>Se Déconnecter</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 20, paddingTop: 5 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, marginTop: 30 },
  backButton: { padding: 10 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', flex: 1, textAlign: 'center' },
  editButton: { padding: 10 },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2
  },
  infoCardText: { fontSize: 18, fontWeight: '600', color: '#333' },
  profileCard: { backgroundColor: '#fff', borderRadius: 10, padding: 15, elevation: 2, marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '600', color: '#666', flex: 1 },
  value: { fontSize: 16, color: '#333', flex: 2, textAlign: 'right' },
  input: {
    flex: 2,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  saveButton: { backgroundColor: '#28a745', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  disabledButton: { backgroundColor: '#a5d6a7' },
  logoutButton: { backgroundColor: '#e74c3c', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  historySection: { marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 15 },
  orderCard: { backgroundColor: '#fff', borderRadius: 10, padding: 10, elevation: 2, marginBottom: 15 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderLabel: { fontSize: 14, fontWeight: '600', color: '#666' },
  orderValue: { fontSize: 14, color: '#333' },
  noOrdersText: { fontSize: 16, color: '#fff', textAlign: 'center' },
  trackButton: { backgroundColor: '#28a745', padding: 8, borderRadius: 5, alignItems: 'center', marginTop: 10 },
  trackButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
