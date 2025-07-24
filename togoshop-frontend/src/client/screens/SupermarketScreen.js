import React, { useEffect, useCallback, useContext, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../../shared/context/AppContext';
import { getSupermarkets, getSupermarketStatus } from '../../shared/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SupermarketItem from '../components/SupermarketItem'; 

export default function SupermarketScreen({ navigation }) {
  const { supermarkets, setSupermarkets, setSelectedSupermarket, loading, setLoading, error, setError } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchSupermarkets = async () => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          setError('Utilisateur non connecté');
          navigation.navigate('LoginStack'); 
          return;
        }
        const response = await getSupermarkets();
        const supermarketsWithStatus = await Promise.all(
          response.data.map(async (supermarket) => {
            const status = await getSupermarketStatus(supermarket._id);
            return { ...supermarket, ...status };
          })
        );
        setSupermarkets(supermarketsWithStatus);
      } catch (err) {
        setError(`Erreur: ${err.message}`);
        if (err.response?.status === 401) navigation.navigate('LoginStack');
      } finally {
        setLoading(false);
      }
    };
    fetchSupermarkets();
  }, []);

  const handleSupermarketPress = useCallback((supermarket) => {
    setSelectedSupermarket(supermarket);
    navigation.navigate('Sites'); 
  }, []);

  const filteredSupermarkets = supermarkets?.filter(supermarket =>
    supermarket.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#28a745" />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un supermarché..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#666"
            />
          </View>
        </View>
        {filteredSupermarkets && filteredSupermarkets.length > 0 ? (
          <FlatList
            data={filteredSupermarkets}
            renderItem={({ item }) => <SupermarketItem item={item} onPress={handleSupermarketPress} />}
            keyExtractor={(item) => item._id}
            style={styles.list}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucun supermarché trouvé.</Text>}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun supermarché disponible.</Text>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flex: 1,
  },
  header: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
    elevation: 4,
    borderRadius: 10,
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
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#dc3545', 
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280', 
    fontSize: 16,
    fontWeight: '400',
  },
});