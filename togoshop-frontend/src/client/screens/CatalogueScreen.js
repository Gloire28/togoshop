import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  TextInput,
  Vibration,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupermarkets, getProducts, getSupermarketStatus } from '../../shared/services/api';
import imageMap from '../../assets/imageMap';
import { AppContext } from '../../shared/context/AppContext';

export default function CatalogueScreen({ navigation }) {
  const { addToCart, cart, user, refreshData } = useContext(AppContext);
  const [state, setState] = useState({
    supermarkets: [],
    loading: true,
    error: null,
    currentStep: 'supermarkets',
    selectedSupermarket: null,
    locations: [],
    selectedLocationId: null,
    products: [],
    searchQuery: '',
    selectedCategory: 'Tous',
    supermarketStatus: null,
  });

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          Alert.alert(
            'Connexion requise',
            'Vous devez vous connecter.',
            [{ text: 'Se connecter', onPress: () => navigation.navigate('Login') }]
          );
          setState((prev) => ({ ...prev, error: 'Utilisateur non connecté', loading: false }));
          return;
        }
        await fetchSupermarkets();
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      } catch (err) {
        setState((prev) => ({ ...prev, error: 'Erreur d’authentification', loading: false }));
      }
    };
    checkAuthAndFetch();
  }, []);

  const fetchSupermarkets = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const token = await AsyncStorage.getItem('token');
      const response = await getSupermarkets();
      const supermarketsWithStatus = await Promise.all(
        response.data.map(async (supermarket) => {
          const status = await getSupermarketStatus(supermarket._id);
          return { ...supermarket, ...status };
        })
      );
      setState((prev) => ({
        ...prev,
        supermarkets: supermarketsWithStatus,
        loading: false,
      }));
    } catch (err) {
      console.error('Erreur:', err);
      setState((prev) => ({
        ...prev,
        error: `Erreur: ${err.message}`,
        loading: false,
      }));
      if (err.response?.status === 401) {
        Alert.alert('Session expirée', 'Reconnectez-vous.', [
          { text: 'Se connecter', onPress: () => navigation.navigate('Login') },
        ]);
      }
    }
  }, []);

  const fetchLocations = useCallback((supermarket) => {
    if (!supermarket || !supermarket._id) {
      Alert.alert('Erreur', 'Supermarché invalide.');
      return;
    }
    setState((prev) => ({
      ...prev,
      selectedSupermarket: supermarket,
      locations: supermarket.locations || [],
      currentStep: 'locations',
      supermarketStatus: supermarket,
    }));
  }, []);

  const fetchProducts = useCallback(async (supermarket, locationId) => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      if (!supermarket || !supermarket._id) {
        throw new Error('Aucun supermarché sélectionné');
      }
      const response = await getProducts(supermarket._id, locationId);
      const products = Array.isArray(response) ? response : [];
      setState((prev) => ({
        ...prev,
        products,
        selectedLocationId: locationId,
        loading: false,
        currentStep: 'products',
      }));
    } catch (err) {
      console.error('Erreur produits:', err);
      setState((prev) => ({
        ...prev,
        error: `Erreur: ${err.message}`,
        loading: false,
      }));
      if (err.response?.status === 401) {
        Alert.alert('Session expirée', 'Reconnectez-vous.', [
          { text: 'Se connecter', onPress: () => navigation.navigate('Login') },
        ]);
      }
    }
  }, []);

  const addToCartHandler = useCallback(
    async (product) => {
      if (!state.supermarketStatus?.isOpen) {
        Alert.alert('Site fermé', 'Les achats sont désactivés lorsque le site est fermé.');
        return;
      }
      const stockAtLocation = product.stockByLocation.find(
        (stock) => stock.locationId === state.selectedLocationId
      ) || { stock: 0 };
      if (stockAtLocation.stock <= 0) {
        Alert.alert('Erreur de stock', 'Stock indisponible.');
        return;
      }
      const result = await addToCart({
        ...product,
        locationId: state.selectedLocationId,
        supermarketId: state.selectedSupermarket?._id,
      });
      if (result.success) {
        Vibration.vibrate(200);
        Alert.alert('Succès', `${product.name} ajouté au panier !`);
      }
    },
    [state.selectedLocationId, state.selectedSupermarket, addToCart, state.supermarketStatus]
  );

  const filteredProducts = useCallback(() => {
    let filtered = [...state.products];
    if (state.selectedCategory !== 'Tous') {
      filtered = filtered.filter((p) => p.category === state.selectedCategory);
    }
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [state.products, state.selectedCategory, state.searchQuery]);

  const renderItem = useCallback(
    ({ item, type }) => {
      switch (type) {
        case 'supermarket':
          return (
            <TouchableOpacity style={styles.supermarketItem} onPress={() => fetchLocations(item)}>
              <Text style={styles.itemText}>{item.name}</Text>
              <Text style={styles.subText}>
                {item.locations.length} site(s) -{' '}
                {item.isOpen ? 'Ouvert' : `Fermé (${item.status || 'Inconnu'})`}
              </Text>
            </TouchableOpacity>
          );
        case 'location':
          return (
            <TouchableOpacity style={styles.locationItem} onPress={() => fetchProducts(state.selectedSupermarket, item._id)}>
              <Text style={styles.itemText}>{item.name}</Text>
              <Text style={styles.subText}>{item.address}</Text>
            </TouchableOpacity>
          );
        case 'product':
          const stockAtLocation = item.stockByLocation?.find((s) => s.locationId === state.selectedLocationId) || { stock: 0 };
          const stockColor = stockAtLocation.stock > 15 ? '#00FF00' : stockAtLocation.stock >= 7 ? '#FFD700' : '#FF0000';
          const imageSource = imageMap[item._id] || null;
          const isPromoted = item.promotedPrice !== null && item.promotedPrice < item.price;
          const discountPercentage = isPromoted ? Math.round(((item.price - item.promotedPrice) / item.price) * 100) : 0;

          return (
            <Animated.View style={[styles.productCard, { opacity: fadeAnim }]}>
              {isPromoted && (
                <Animated.View
                  style={[
                    styles.promoBadge,
                    { opacity: fadeAnim },
                  ]}
                >
                  <Text style={styles.promoText}>{`-${discountPercentage}%`}</Text>
                </Animated.View>
              )}
              <View style={styles.productImageContainer}>
                {imageSource ? (
                  <Image source={imageSource} style={styles.productImage} resizeMode="contain" />
                ) : (
                  <View style={styles.placeholderImage}>
                    <Text style={styles.placeholderText}>Image à venir</Text>
                  </View>
                )}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <View style={styles.priceContainer}>
                  {isPromoted ? (
                    <>
                      <Text style={styles.promotedPrice}>{item.promotedPrice} FCFA</Text>
                      <Text style={styles.originalPrice}>{item.price} FCFA</Text>
                    </>
                  ) : (
                    <Text style={styles.productPrice}>{item.price} FCFA</Text>
                  )}
                </View>
                <Text style={styles.productWeight}>{item.weight} kg</Text>
                <View style={[styles.stockIndicator, { backgroundColor: stockColor }]} />
              </View>
              <TouchableOpacity
                style={[
                  styles.addButton,
                  !state.supermarketStatus?.isOpen && styles.disabledButton,
                ]}
                onPress={() => addToCartHandler(item)}
                disabled={!state.supermarketStatus?.isOpen}
              >
                <Ionicons name="cart-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          );
        default:
          return null;
      }
    },
    [state.selectedSupermarket, state.selectedLocationId, addToCartHandler, fadeAnim, state.supermarketStatus]
  );

  const renderCartIcon = useCallback(() => {
    const cartCount = cart.length;
    return (
      <View
        style={styles.cartIcon}
        onLongPress={() => Alert.alert('Panier', `Contient ${cartCount} articles`)}
      >
        <Ionicons name="cart" size={30} color="#333" />
        {cartCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{cartCount}</Text>
          </View>
        )}
      </View>
    );
  }, [cart]);

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

  if (state.loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#808080" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (state.error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{state.error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchSupermarkets}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const displayedProducts = filteredProducts();
  const hasProducts = displayedProducts.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {state.supermarketStatus && !state.supermarketStatus.isOpen && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Ce site est actuellement fermé. Vous pouvez consulter le catalogue, mais les achats sont désactivés.
            {state.supermarketStatus.status && ` Raison : ${state.supermarketStatus.status}`}
          </Text>
        </View>
      )}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => {
              if (state.currentStep === 'locations' || state.currentStep === 'products') {
                fetchLocations(state.selectedSupermarket);
              } else {
                setState((prev) => ({ ...prev, currentStep: 'supermarkets' }));
              }
            }}
          >
            <Text style={styles.backButton}>Site</Text>
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
        {state.currentStep === 'supermarkets' && (
          <FlatList
            data={state.supermarkets}
            renderItem={(props) => renderItem({ ...props, type: 'supermarket' })}
            keyExtractor={(item) => item._id}
            style={styles.list}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucun supermarché.</Text>}
          />
        )}
        {state.currentStep === 'locations' && (
          <FlatList
            data={state.locations}
            renderItem={(props) => renderItem({ ...props, type: 'location' })}
            keyExtractor={(item) => item._id}
            style={styles.list}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucun site.</Text>}
          />
        )}
        {state.currentStep === 'products' && (
          <FlatList
            data={displayedProducts}
            renderItem={(props) => renderItem({ ...props, type: 'product' })}
            keyExtractor={(item) => item._id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            style={styles.list}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucun produit trouvé.</Text>}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  supermarketItem: {
    marginVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  locationItem: {
    marginVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  productCard: {
    flex: 1,
    margin: 5,
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    maxWidth: '48%',
  },
  productImageContainer: {
    aspectRatio: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 12,
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#666',
  },
  promotedPrice: {
    fontSize: 16,
    color: '#28a745',
    fontWeight: 'bold',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  productWeight: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  stockIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    top: 5,
    right: 5,
  },
  addButton: {
    backgroundColor: '#007bff',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    margin: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.5,
  },
  promoBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  promoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
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
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  },
});