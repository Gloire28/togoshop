import React from "react";
import { Platform, View, Text, StyleSheet } from "react-native";

let MapView, Marker;

if (Platform.OS === "web") {
  // Solution alternative pour le web
  MapView = ({ children, style, ...props }) => (
    <View style={[styles.webMapContainer, style]}>
      <Text style={styles.webMapText}>Carte non disponible en version web</Text>
      {children}
    </View>
  );
  Marker = ({ children }) => <>{children}</>;
} else {
  const NativeMaps = require("react-native-maps");
  MapView = NativeMaps.default;
  Marker = NativeMaps.Marker;
}

const styles = StyleSheet.create({
  webMapContainer: {
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  webMapText: {
    color: "#666",
    textAlign: "center",
  },
});

export { MapView, Marker };

// Option: Vous pouvez aussi exporter un composant par défaut si nécessaire
const CustomMapView = (props) => <MapView {...props} style={{ flex: 1 }} />;
export default CustomMapView;
