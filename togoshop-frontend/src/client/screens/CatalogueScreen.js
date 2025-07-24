import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  TextInput,
  Vibration,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getProducts, getSupermarketStatus } from '../../shared/services/api';
import { AppContext } from '../../shared/context/AppContext';
import ProductItem from '../components/ProductItem';

const CatalogueScreen = ({ navigation }) => {
  const { 
    addToCart, 
    cart, 
    selectedSupermarket, 
    selectedLocationId, 
    setProducts, 
    loading, 
    setLoading, 
    setError, 
    error, 
    supermarketStatus, 
    setSupermarketStatus,
    products 
  } = useContext(AppContext);
  
  const [state, setState] = useState({
    searchQuery: '',
    selectedCategory: 'Tous',
  });

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Fonction pour déterminer la couleur du stock
  const getStockStatus = (stock) => {
    if (stock <= 5) {
      return { color: '#ff4d4f' }; // Rouge pour 0 à 5
    } else if (stock > 5 && stock <= 15) {
      return { color: '#f1c40f' }; // Jaune pour 5 à 15
    } else {
      return { color: '#28a745' }; // Vert pour > 15
    }
  };

  // Charger les produits et le statut du supermarché
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!selectedSupermarket || !selectedLocationId) {
          setError('Aucun site sélectionné.');
          return;
        }
        
        // Charger les produits
        const response = await getProducts(selectedSupermarket._id, selectedLocationId);
        const fetchedProducts = Array.isArray(response) ? response : [];
        setProducts(fetchedProducts);
        
        // Charger le statut du supermarché
        const statusResponse = await getSupermarketStatus(selectedSupermarket._id);
        setSupermarketStatus({
          ...statusResponse,
          isOpen: statusResponse.status === 'open'
        });
        
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      } catch (err) {
        setError(`Erreur: ${err.message}`);
        if (err.response?.status === 401) navigation.navigate('Login');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [selectedLocationId]);

  const addToCartHandler = useCallback(
    async (product) => {
      // Vérifier si le supermarché est ouvert
      if (!supermarketStatus || supermarketStatus.status !== 'open') {
        Alert.alert(
          'Site fermé', 
          'Les achats sont désactivés lorsque le site est fermé.' +
          (supermarketStatus?.closureReason ? `\nRaison: ${supermarketStatus.closureReason}` : '')
        );
        return;
      }
      
      // Vérifier le stock
      const stockAtLocation = product.stockByLocation?.find(
        (stock) => stock.locationId === selectedLocationId
      ) || { stock: 0 };
      
      if (stockAtLocation.stock <= 0) {
        Alert.alert('Erreur de stock', 'Stock indisponible pour ce produit.');
        return;
      }
      
      try {
        const result = await addToCart({
          ...product,
          locationId: selectedLocationId,
          supermarketId: selectedSupermarket?._id,
        });
        
        if (result.success) {
          Vibration.vibrate(200);
          Alert.alert('Succès', `${product.name} ajouté au panier !`);
        }
      } catch (error) {
        Alert.alert('Erreur', error.message || 'Impossible d\'ajouter le produit');
      }
    },
    [selectedLocationId, selectedSupermarket, addToCart, supermarketStatus]
  );

  const filteredProducts = useCallback(() => {
    if (!products || !Array.isArray(products)) return [];
    
    let filtered = [...products];
    if (state.selectedCategory !== 'Tous') {
      filtered = filtered.filter((p) => p.category === state.selectedCategory);
    }
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) => 
          (p.name && p.name.toLowerCase().includes(query)) || 
          (p.description && p.description.toLowerCase().includes(query))
      );
    }
    return filtered;
  }, [products, state.selectedCategory, state.searchQuery]);

  const renderCartIcon = useCallback(() => {
    const cartCount = cart.reduce((total, item) => total + (item.quantity || 0), 0);
    
    return (
      <TouchableOpacity 
        style={styles.cartIcon}
        onPress={() => navigation.navigate('Cart')}
      >
        <Ionicons name="cart" size={30} color="#333" />
        {cartCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{cartCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [cart, navigation]);

  const categories = [
    'Tous',
    'Fruits',
    'Légumes',
    'Viandes',
    'Produits Laitiers',
    'Épicerie',
    'Boissons',
    'Céréales',
    'Autres',
    'Vêtements',
    'Électronique',
  ];

  const renderCategoryTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryTabs}>
      {categories.map((category) => (
        <TouchableOpacity
          key={category}
          style={[
            styles.categoryTab,
            state.selectedCategory === category && styles.selectedCategoryTab,
          ]}
          onPress={() => setState((prev) => ({ ...prev, selectedCategory: category }))}
        >
          <Text
            style={[
              styles.categoryText,
              state.selectedCategory === category ? styles.selectedCategoryText : null,
            ]}
          >
            {category}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#808080" />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Retour</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const displayedProducts = filteredProducts();

  return (
    <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        {supermarketStatus && supermarketStatus.status !== 'open' && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Ce site est actuellement fermé. Vous pouvez consulter le catalogue, mais les achats sont désactivés.
              {supermarketStatus.closureReason && `\nRaison: ${supermarketStatus.closureReason}`}
            </Text>
          </View>
        )}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backButton}>Retour</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Catalogue</Text>
            {renderCartIcon()}
          </View>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchBar}
              placeholder="Rechercher..."
              value={state.searchQuery}
              onChangeText={(text) => setState((prev) => ({ ...prev, searchQuery: text }))}
              placeholderTextColor="#666"
            />
          </View>
          {renderCategoryTabs()}
        </View>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={displayedProducts}
            renderItem={({ item }) => {
              const stockAtLocation = item.stockByLocation?.find(
                (stock) => stock.locationId === selectedLocationId
              ) || { stock: 0 };
              const stockStatus = getStockStatus(stockAtLocation.stock);
              return (
                <ProductItem 
                  item={item} 
                  addToCartHandler={addToCartHandler} 
                  fadeAnim={fadeAnim} 
                  isSupermarketOpen={supermarketStatus?.status === 'open'}
                  stockStatus={stockStatus}
                />
              );
            }}
            keyExtractor={(item) => item._id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Aucun produit trouvé.</Text>
                <Text style={styles.emptySubText}>Veuillez vérifier votre sélection ou votre recherche.</Text>
              </View>
            }
          />
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default CatalogueScreen;

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flex: 1,
  },
  banner: {
    backgroundColor: '#ff4444',
    padding: 10,
    alignItems: 'center',
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  header: {
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    elevation: 2,
    borderRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    fontSize: 16,
    color: '#007bff',
    marginRight: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
  },
  cartIcon: {
    padding: 5,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: '#FF0000',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  searchBar: {
    flex: 1,
    height: 40,
    paddingHorizontal: 10,
  },
  searchIcon: {
    paddingLeft: 10,
  },
  categoryTabs: {
    marginBottom: 10,
  },
  categoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  selectedCategoryTab: {
    backgroundColor: '#007bff',
  },
  categoryText: {
    fontSize: 14,
    color: '#333',
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    flex: 1,
    paddingHorizontal: 5,
  },
  columnWrapper: {
    justifyContent: 'space-between',
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
    color: '#ff4d4f',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 10,
  },
});