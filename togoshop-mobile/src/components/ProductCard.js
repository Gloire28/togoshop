import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

const ProductCard = ({ product, onPress }) => (
  <TouchableOpacity onPress={onPress}>
    <View>
      <Text>{product.name} - {product.price} FCFA</Text>
    </View>
  </TouchableOpacity>
);

export default ProductCard;