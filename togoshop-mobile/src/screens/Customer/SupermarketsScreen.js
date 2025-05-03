import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Button } from 'react-native';
import { getSupermarkets } from '../services/api';
import { sortByProximity } from '../services/geolocation';

const SupermarketsScreen = ({ navigation }) => {
  const [supermarkets, setSupermarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSupermarkets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getSupermarkets();
      const sortedSupermarkets = await sortByProximity(response.data);
      setSupermarkets(sortedSupermarkets);
      setLoading(false);
    } catch (err) {
      setError('Erreur lors de la récupération des supermarchés');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupermarkets();
  }, []);

  const renderSupermarket = ({ item }) => (
    <TouchableOpacity
      style={styles.supermarketItem}
      onPress={() => navigation.navigate('SitesScreen', { supermarketId: item._id })}
    >
      <Text style={styles.supermarketName}>{item.name}</Text>
      {item.distance !== undefined && (
        <Text style={styles.distanceText}>
          Distance: {item.distance.toFixed(1)} km
        </Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Réessayer" onPress={fetchSupermarkets} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choisir un supermarché</Text>
      <FlatList
        data={supermarkets}
        renderItem={renderSupermarket}
        keyExtractor={(item) => item._id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  supermarketItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  supermarketName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  distanceText: {
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
});

export default SupermarketsScreen;