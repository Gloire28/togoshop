import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../../shared/context/AppContext';
import { apiRequest, getUserOrders } from '../../shared/services/api';

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

  useEffect(() => {
    if (!user) return;

    const fetchUserProfile = async () => {
      setProfileLoading(true);
      try {
        const data = await apiRequest('/users/me');
        if (JSON.stringify(data) !== JSON.stringify(user)) {
          setUser(data);
          setName(data.name || '');
          setEmail(data.email || '');
          setPhone(data.phone || '');
        }
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
      } finally {
        setOrdersLoading(false);
      }
    };

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

      const data = await apiRequest('/users/update-profile', { method: 'PUT', body: updatedData });
      setUser(data.user);
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mon Profil</Text>
        <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.editButton}>
          <Ionicons name={isEditing ? 'close' : 'pencil'} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {profileLoading ? (
        <ActivityIndicator size="large" color="#3498db" style={{ marginVertical: 20 }} />
      ) : user ? (
        <View style={styles.profileCard}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Nom :</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Entrez votre nom"
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
                secureTextEntry
              />
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Compte créé le :</Text>
            <Text style={styles.value}>
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
            </Text>
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
      ) : (
        <Text style={styles.infoText}>Client Togo Shop</Text>
      )}

      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Historique des Commandes</Text>
        {ordersLoading ? (
          <ActivityIndicator size="large" color="#3498db" />
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

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.buttonText}>Se Déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50' },
  editButton: { backgroundColor: '#3498db', padding: 10, borderRadius: 50 },
  profileCard: { backgroundColor: '#fff', borderRadius: 10, padding: 20, elevation: 2, marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  label: { fontSize: 16, fontWeight: '600', color: '#666', flex: 1 },
  value: { fontSize: 16, color: '#333', flex: 2, textAlign: 'right' },
  input: { flex: 2, borderWidth: 1, borderColor: '#ddd', borderRadius: 5, padding: 8, fontSize: 16, backgroundColor: '#f9f9f9' },
  saveButton: { backgroundColor: '#28a745', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  disabledButton: { backgroundColor: '#a0a0a0' },
  logoutButton: { backgroundColor: '#e74c3c', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  infoText: { fontSize: 18, color: '#666', textAlign: 'center', marginTop: 20 },
  historySection: { marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#2c3e50', marginBottom: 15 },
  orderCard: { backgroundColor: '#fff', borderRadius: 10, padding: 15, elevation: 2, marginBottom: 15 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderLabel: { fontSize: 14, fontWeight: '600', color: '#666' },
  orderValue: { fontSize: 14, color: '#333' },
  noOrdersText: { fontSize: 16, color: '#666', textAlign: 'center' },
  trackButton: { backgroundColor: '#3498db', padding: 8, borderRadius: 5, alignItems: 'center', marginTop: 10 },
  trackButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});