import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { getTracking } from "services/api"; // Alias fonctionnel
import { MapView, Marker } from "../../components/MapWrapper";

const TrackingScreen = ({ navigation }) => {
  console.log("getTracking:", getTracking);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test d'Importation (Tracking)</Text>
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

export default TrackingScreen;
