import React, { useContext } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { AppContext } from '../../context/AppContext';

export default function ProductDetailScreen({ route, navigation }) {
  const { product } = route.params; // Produit passé via navigation
  const { addToCart } = useContext(AppContext);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{product.name}</Text>
      <Text style={styles.price}>{product.price} FCFA</Text>
      <Text style={styles.weight}>{product.weight} kg</Text>
      <Button
        title="Ajouter au panier"
        onPress={() => {
          addToCart(product);
          alert('Ajouté au panier !');
        }}
      />
      <Button
        title="Retour au Catalogue"
        onPress={() => navigation.goBack()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  price: {
    fontSize: 16,
    marginBottom: 5,
  },
  weight: {
    fontSize: 14,
    marginBottom: 20,
  },
});