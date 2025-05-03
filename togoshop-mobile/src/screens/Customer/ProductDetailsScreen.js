import React from 'react';
import { View, Text } from 'react-native';

const ProductDetailsScreen = ({ route }) => {
  const { product } = route.params;

  return (
    <View>
      <Text>{product.name} - {product.price} FCFA</Text>
      <Text>{product.description}</Text>
    </View>
  );
};

export default ProductDetailsScreen;