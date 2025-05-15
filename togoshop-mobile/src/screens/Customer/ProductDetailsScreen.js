import React from "react";
import { View, Text, StyleSheet } from "react-native";
import * as api from "services/api"; // Utilise l'alias

const ProductDetailsScreen = ({ navigation }) => {
  console.log("API imports:", api); // Vérifie l'importation

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test d'Importation (Product Details)</Text>
      <Text>Importation réussie si pas d'erreur.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
});

export default ProductDetailsScreen;
