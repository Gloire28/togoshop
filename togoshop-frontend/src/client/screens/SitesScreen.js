import React, { useContext, useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, SafeAreaView, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../shared/context/AppContext';
import LocationItem from '../components/LocationItem';

export default function SitesScreen({ navigation }) {
  const { selectedSupermarket, setSelectedLocationId, setProducts } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLocationPress = useCallback((locationId) => {
    setSelectedLocationId(locationId);
    setProducts([]); 
    navigation.navigate('Catalogue');
  }, [setSelectedLocationId, setProducts]);

  if (!selectedSupermarket) {
    navigation.goBack();
    return null;
  }

  const locations = selectedSupermarket?.locations || [];
  const filteredLocations = locations.filter(location =>
    location.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    location._id?.toLowerCase().includes(searchQuery.toLowerCase())    
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un site..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#666"
          />
        </View>
      </View>
      <FlatList
        data={filteredLocations}
        renderItem={({ item }) => <LocationItem item={item} onPress={() => handleLocationPress(item._id)} />}
        keyExtractor={(item) => item._id}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun site trouvé.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8', 
  },
  header: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
    elevation: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 25,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  list: {
    flex: 1,
    paddingHorizontal: 5,
    paddingTop: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280', 
    fontSize: 16,
    fontWeight: '400',
    marginTop: 20,
  },
});