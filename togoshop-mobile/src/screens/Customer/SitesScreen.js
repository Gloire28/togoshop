import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Button } from 'react-native';
import { getSites, getPopularProductsStock } from '../services/api';
import { getDistanceToSite } from '../services/geolocation';

const SitesScreen = ({ route, navigation }) => {
  const { supermarketId } = route.params;
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSites = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getSites(supermarketId);
      // Ajouter les distances et vérifier le stock pour chaque site
      const sitesWithDetails = await Promise.all(
        response.data.map(async (site) => {
          const distance = await getDistanceToSite(site);
          const stockResponse = await getPopularProductsStock(supermarketId, site._id);
          const hasPopularStock = stockResponse.data.some((product) => product.stock > 0);
          return { ...site, distance, hasPopularStock };
        })
      );
      setSites(sitesWithDetails);
      setLoading(false);
    } catch (err) {
      setError('Erreur lors de la récupération des sites');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [supermarketId]);

  const renderSite = ({ item }) => (
    <TouchableOpacity
      style={styles.siteItem}
      onPress={() => navigation.navigate('CartScreen', { supermarketId, siteId: item._id })}
    >
      <Text style={styles.siteName}>{item.name}</Text>
      <Text style={styles.siteAddress}>{item.address}</Text>
      {item.distance !== null && (
        <Text style={styles.distanceText}>
          Distance: {item.distance.toFixed(1)} km
        </Text>
      )}
      <Text style={styles.stockText}>
        Produits populaires : {item.hasPopularStock ? 'En stock' : 'Stock faible'}
      </Text>
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
        <Button title="Réessayer" onPress={fetchSites} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choisir un site</Text>
      <FlatList
        data={sites}
        renderItem={renderSite}
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
  siteItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  siteName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  siteAddress: {
    fontSize: 14,
    color: '#666',
  },
  distanceText: {
    fontSize: 14,
    color: '#666',
  },
  stockText: {
    fontSize: 14,
    color: item => (item.hasPopularStock ? 'green' : 'orange'),
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
});

export default SitesScreen;