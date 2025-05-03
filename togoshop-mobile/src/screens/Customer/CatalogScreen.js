import React, { useState, useEffect } from 'react';
import { View, FlatList } from 'react-native';
import { getProducts } from '../../services/api';
import ProductCard from '../../components/ProductCard';
import FilterBar from '../../components/FilterBar';

const CatalogScreen = ({ route }) => {
  const { supermarketId } = route.params || {};
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const response = await getProducts(supermarketId);
      setProducts(response.data);
    };
    fetchProducts();
  }, [supermarketId]);

  return (
    <View>
      <FilterBar />
      <FlatList
        data={products}
        renderItem={({ item }) => <ProductCard product={item} />}
        keyExtractor={(item) => item._id}
      />
    </View>
  );
};

export default CatalogScreen;