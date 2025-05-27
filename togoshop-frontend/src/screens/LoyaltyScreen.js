import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, FlatList, Alert, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../services/api';

export default function LoyaltyScreen({ navigation }) {
  const [loyalty, setLoyalty] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [loading, setLoading] = useState(false);

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

  // Échanger des points
  const handleRedeemPoints = async () => {
    const points = parseInt(pointsToRedeem, 10);
    if (!points || points <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un nombre de points valide.');
      return;
    }

    if (points > (loyalty?.points || 0)) {
      Alert.alert('Erreur', 'Points insuffisants pour cet échange.');
      return;
    }

    try {
      setLoading(true);
      const response = await apiRequest('/loyalty/redeem', {
        method: 'POST',
        body: { points, description: `Échange de ${points} points pour une réduction` },
      });
      setLoyalty(response.loyalty);
      setPointsToRedeem('');
      Alert.alert('Succès', `Vous avez utilisé ${points} points avec succès !`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d’échanger les points.');
      console.log('Erreur lors de l’échange des points:', error.message);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading && !loyalty) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Programme de Fidélité</Text>
      </View>

      <View style={styles.pointsSection}>
        <Text style={styles.pointsText}>Vos Points : {loyalty?.points || 0}</Text>
        <Text style={styles.rewardText}>Récompense : Réduction de 10% pour 100 points</Text>
      </View>

      <View style={styles.redeemSection}>
        <TextInput
          style={styles.input}
          placeholder="Nombre de points à échanger"
          keyboardType="numeric"
          value={pointsToRedeem}
          onChangeText={setPointsToRedeem}
        />
        <TouchableOpacity
          style={[styles.redeemButton, loading && styles.disabledButton]}
          onPress={handleRedeemPoints}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Échanger des Points</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Historique des Transactions</Text>
      {loyalty?.transactions?.length > 0 ? (
        <FlatList
          data={loyalty.transactions}
          renderItem={renderTransaction}
          keyExtractor={(item, index) => index.toString()}
          style={styles.transactionList}
        />
      ) : (
        <Text style={styles.noTransactions}>Aucune transaction pour le moment.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    textAlign: 'center',
  },
  pointsSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
  },
  pointsText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
    textAlign: 'center',
  },
  rewardText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  redeemSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  redeemButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#a5d6a7',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  transactionList: {
    flex: 1,
  },
  transactionItem: {
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    elevation: 1,
  },
  transactionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  transactionDescription: {
    fontSize: 14,
    color: '#666',
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  noTransactions: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});