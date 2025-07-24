import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiRequest } from '../../shared/services/api';

export default function LoyaltyScreen({ navigation }) {
  const [loyalty, setLoyalty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Tous'); // Catégorie sélectionnée

  // Récupérer les points de fidélité
  useEffect(() => {
    const fetchLoyalty = async () => {
      try {
        setLoading(true);
        const response = await apiRequest('/loyalty/me', { method: 'GET' });
        setLoyalty(response);
      } catch (error) {
        Alert.alert('Erreur', 'Impossible de charger les points de fidélité.');
        console.log('Erreur lors de la récupération des points:', error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLoyalty();
  }, []);

  // Catégories pour les onglets
  const categories = ['Tous', 'Gagnés', 'Utilisés'];

  // Filtrer les transactions en fonction de la catégorie sélectionnée
  const filteredTransactions = loyalty?.transactions?.filter((transaction) => {
    if (selectedCategory === 'Tous') return true;
    return transaction.type === (selectedCategory === 'Gagnés' ? 'earned' : 'redeemed');
  }) || [];

  // Rendu d'une transaction
  const renderTransaction = ({ item }) => (
    <View style={styles.transactionItem}>
      <Text style={styles.transactionText}>
        {item.type === 'earned' ? 'Gagné' : 'Utilisé'} : {item.amount} points
      </Text>
      <Text style={styles.transactionDescription}>{item.description}</Text>
      <Text style={styles.transactionDate}>
        {new Date(item.date).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );

  // Texte dynamique pour les récompenses
  const rewardText = 'Savez-vous que vos points peuvent être utilisés pour avoir des réductions.';

  if (loading && !loyalty) {
    return (
      <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#fff" style={{ marginVertical: 20 }} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Programme de Fidélité</Text>
        </View>

        <View style={styles.pointsSection}>
          <Text style={styles.pointsText}>Vos Points : {loyalty?.points || 0}</Text>
          <Text style={styles.rewardText}>{rewardText}</Text>
        </View>

        <View style={styles.categoryContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[styles.categoryItem, selectedCategory === category && styles.categoryItemActive]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Historique des Transactions</Text>
        {filteredTransactions.length > 0 ? (
          <FlatList
            data={filteredTransactions}
            renderItem={renderTransaction}
            keyExtractor={(item, index) => index.toString()}
            style={styles.transactionList}
          />
        ) : (
          <Text style={styles.noTransactions}>Aucune transaction pour le moment.</Text>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 20, paddingTop: 30 }, 
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 20, 
    marginTop: 10, 
    position: 'absolute', 
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  backButton: { padding: 10 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', flex: 1, textAlign: 'center' },
  pointsSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    marginTop: 60, 
    elevation: 2,
  },
  pointsText: { fontSize: 20, fontWeight: 'bold', color: '#28a745', textAlign: 'center' },
  rewardText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 5 },
  categoryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  categoryItem: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    flex: 1,
    marginHorizontal: 5,
    elevation: 2,
    alignItems: 'center',
  },
  categoryItemActive: {
    backgroundColor: '#28a745',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  categoryTextActive: {
    color: '#fff',
  },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 10 },
  transactionList: { flex: 1 },
  transactionItem: {
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    elevation: 1,
  },
  transactionText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  transactionDescription: { fontSize: 14, color: '#666' },
  transactionDate: { fontSize: 12, color: '#999', marginTop: 5 },
  noTransactions: { fontSize: 16, color: '#fff', textAlign: 'center' },
});