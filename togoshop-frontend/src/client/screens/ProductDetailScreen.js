import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../shared/context/AppContext';

export default function ProductDetailScreen({ route, navigation }) {
  console.log('route.params:', route.params); // Log pour déboguer
  const { product } = route.params || {}; // Ajout de || {} pour éviter undefined
  const { addToCart } = useContext(AppContext);

  // Vérifier si product existe
  if (!product) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Produit non trouvé</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calcul des prix avec validation
  const originalPrice = product.price || 0;
  let discountedPrice = originalPrice;
  let isDiscounted = false;
  if (route.params?.discountValue && route.params?.discountType) {
    const discountValue = parseFloat(route.params.discountValue) || 0;
    if (route.params.discountType === 'fixed' && discountValue >= 0) {
      discountedPrice = Math.max(0, originalPrice - discountValue);
      isDiscounted = true;
    } else if (route.params.discountType === 'percentage' && discountValue >= 0 && discountValue <= 100) {
      discountedPrice = originalPrice * (1 - discountValue / 100);
      isDiscounted = true;
    } else {
      console.log('Valeur de réduction invalide:', route.params.discountValue, route.params.discountType);
    }
  }

  const handleAddToCart = () => {
    try {
      if (!route.params?.supermarketId || !route.params?.locationId) {
        throw new Error('Données de localisation manquantes (supermarketId ou locationId)');
      }
      addToCart({
        ...product,
        supermarketId: route.params.supermarketId,
        locationId: route.params.locationId,
        promotedPrice: isDiscounted ? Math.round(discountedPrice) : null, 
      });
      Alert.alert('Succès', `${product.name} ajouté au panier${isDiscounted ? ' avec réduction' : ''}`);
    } catch (error) {
      console.log('Erreur ajout au panier:', error.message);
      Alert.alert('Erreur', error.message || 'Impossible d’ajouter au panier');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Détails du Produit</Text>
      <View style={styles.productImageContainer}>
        <Image
          style={styles.productImage}
          source={{ uri: product.imageUrl || 'https://via.placeholder.com/150' }} 
          onError={(e) => console.log('Erreur chargement image:', { error: e.nativeEvent.error, url: product.imageUrl })}
        />
      </View>
      <Text style={styles.description}>
        {product.description || 'Pas de description disponible'}
      </Text>
      <View style={styles.priceContainer}>
        {isDiscounted && (
          <Text style={styles.originalPrice}>{originalPrice} FCFA</Text>
        )}
        <Text style={styles.discountedPrice}>{Math.round(discountedPrice)} FCFA</Text>
      </View>
      <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
        <Text style={styles.addButtonText}>Ajouter</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="home" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  productImageContainer: {
    width: 150,
    height: 150,
    backgroundColor: '#e6f0fa',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  description: {
    fontSize: 16,
    color: '#34495e',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  originalPrice: {
    fontSize: 20,
    color: '#e74c3c',
    textDecorationLine: 'line-through',
    marginRight: 10,
  },
  discountedPrice: {
    fontSize: 20,
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    width: '100',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 20,
  },
});