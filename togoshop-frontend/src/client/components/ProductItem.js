import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ProductItem = memo(({ item, addToCartHandler, fadeAnim, isSupermarketOpen }) => {
  const stockAtLocation = item.stockByLocation?.find((s) => s.locationId === item.locationId) || { stock: 0 };
  const stockColor = stockAtLocation.stock > 15 ? '#00FF00' : stockAtLocation.stock >= 7 ? '#FFD700' : '#FF0000';
  const isPromoted = item.promotedPrice !== null && item.promotedPrice < item.price;
  const discountPercentage = isPromoted ? Math.round(((item.price - item.promotedPrice) / item.price) * 100) : 0;
  const imageUrl = item.imageUrl || 'https://via.placeholder.com/150';
  
  // Animation pour le feedback visuel
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handleAddToCart = () => {
    if (!isSupermarketOpen) return;
    
    // Animation de feedback
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();
    
    addToCartHandler(item);
  };

  return (
    <Animated.View style={[styles.productCard, { opacity: fadeAnim }]}>
      {isPromoted && (
        <Animated.View style={[styles.promoBadge, { opacity: fadeAnim }]}>
          <Text style={styles.promoText}>{`-${discountPercentage}%`}</Text>
        </Animated.View>
      )}
      <View style={styles.productImageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.productImage}
            resizeMode="contain"
            onError={(e) => console.log('Erreur image:', e.nativeEvent.error)}
          />
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
          !isSupermarketOpen && styles.disabledButton
        ]}
        onPress={handleAddToCart}
        disabled={!isSupermarketOpen}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Ionicons name="cart-outline" size={24} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
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
});

export default ProductItem;