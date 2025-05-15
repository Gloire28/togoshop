import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapWrapper from "../../components/MapWrapper";
const { MapView, Marker } = MapWrapper;
import * as Location from "expo-location";
import { getSupermarkets, createPayment } from "../../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LocationSelectionScreen = ({ route, navigation }) => {
  const { orderId, paymentData, mode = "cash" } = route.params || {};
  const [locations, setLocations] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [manualAddress, setManualAddress] = useState("");
  const [selectionMode, setSelectionMode] = useState("list");

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await getSupermarkets();
        const supermarkets = response.data || [];
        const availableLocations = supermarkets.flatMap((supermarket) =>
          supermarket.locations.map((location) => ({
            supermarketId: supermarket._id,
            supermarketName: supermarket.name,
            locationId: location._id,
            address: location.address,
            lat: location.coordinates.lat,
            lng: location.coordinates.lng,
          })),
        );
        setLocations(availableLocations);
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des supermarchés:",
          error,
        );
        Alert.alert(
          "Erreur",
          "Impossible de charger les emplacements disponibles",
        );
      }
    };

    const requestLocationPermission = async () => {
      if (Platform.OS === "web") {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setCurrentLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
              setSelectedLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            },
            (error) => {
              Alert.alert(
                "Erreur",
                "Impossible d'accéder à la localisation sur le web.",
              );
            },
          );
        }
        return;
      }

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission refusée",
          "L'accès à la localisation est nécessaire pour utiliser la carte.",
        );
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setSelectedLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    };

    fetchLocations();
    if (selectionMode === "map") {
      requestLocationPermission();
    }
  }, [selectionMode]);

  const handleSelectLocation = async (location) => {
    if (mode === "cash") {
      try {
        const updatedPaymentData = {
          ...paymentData,
          pickupLocation: {
            supermarketId: location.supermarketId,
            locationId: location.locationId,
            address: location.address,
            lat: location.lat,
            lng: location.lng,
          },
        };

        const paymentResponse = await createPayment(updatedPaymentData);
        if (paymentResponse.status === 201) {
          Alert.alert(
            "Succès",
            "Paiement en espèces confirmé. Rendez-vous à l'emplacement choisi pour récupérer votre commande.",
          );
          await AsyncStorage.setItem("cart", JSON.stringify([]));
          navigation.navigate("Catalog");
        }
      } catch (error) {
        console.error("Erreur lors de la confirmation du paiement:", error);
        Alert.alert(
          "Erreur",
          error.response?.data?.message ||
            "Erreur lors de la confirmation du paiement",
        );
      }
    } else {
      const selectedAddress = {
        address: location.address,
        lat: location.lat,
        lng: location.lng,
      };
      navigation.navigate("Payment", { selectedAddress });
    }
  };

  const handleConfirmManualAddress = () => {
    if (!manualAddress.trim()) {
      Alert.alert("Erreur", "Veuillez entrer une adresse valide.");
      return;
    }

    if (mode === "cash") {
      Alert.alert(
        "Erreur",
        "Le paiement en espèces nécessite un emplacement de récupération parmi la liste.",
      );
    } else {
      const selectedAddress = {
        address: manualAddress,
        lat: null,
        lng: null,
      };
      navigation.navigate("Payment", { selectedAddress });
    }
  };

  const handleConfirmMapLocation = () => {
    if (!selectedLocation) {
      Alert.alert("Erreur", "Veuillez sélectionner une position sur la carte.");
      return;
    }

    if (mode === "cash") {
      Alert.alert(
        "Erreur",
        "Le paiement en espèces nécessite un emplacement de récupération parmi la liste.",
      );
    } else {
      const selectedAddress = {
        address: "Adresse sélectionnée sur la carte",
        lat: selectedLocation.latitude,
        lng: selectedLocation.longitude,
      };
      navigation.navigate("Payment", { selectedAddress });
    }
  };

  const renderLocation = ({ item }) => (
    <TouchableOpacity
      style={styles.locationItem}
      onPress={() => handleSelectLocation(item)}
    >
      <View style={styles.locationDetails}>
        <Text style={styles.locationName}>
          {item.supermarketName} - {item.address}
        </Text>
        <Text style={styles.locationCoords}>
          Lat: {item.lat}, Lng: {item.lng}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );

  const renderSelectionMode = () => {
    switch (selectionMode) {
      case "list":
        return (
          <View style={styles.selectionContainer}>
            <Text style={styles.sectionTitle}>
              Choisir parmi les emplacements
            </Text>
            {locations.length > 0 ? (
              <FlatList
                data={locations}
                renderItem={renderLocation}
                keyExtractor={(item) =>
                  `${item.supermarketId}-${item.locationId}`
                }
                style={styles.list}
              />
            ) : (
              <Text style={styles.emptyText}>Aucun emplacement disponible</Text>
            )}
          </View>
        );

      case "manual":
        return (
          <View style={styles.selectionContainer}>
            <Text style={styles.sectionTitle}>
              Saisir une adresse manuellement
            </Text>
            <TextInput
              style={styles.manualInput}
              value={manualAddress}
              onChangeText={setManualAddress}
              placeholder="Entrez votre adresse..."
              placeholderTextColor="#B0B0B0"
              multiline
            />
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmManualAddress}
            >
              <Text style={styles.confirmButtonText}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        );

      case "map":
        return (
          <View style={styles.selectionContainer}>
            <Text style={styles.sectionTitle}>Sélectionner sur la carte</Text>
            {currentLocation ? (
              <MapView
                style={styles.map}
                initialRegion={currentLocation}
                onPress={(e) => setSelectedLocation(e.nativeEvent.coordinate)}
              >
                {selectedLocation && <Marker coordinate={selectedLocation} />}
              </MapView>
            ) : (
              <Text style={styles.loadingText}>
                Chargement de la localisation...
              </Text>
            )}
            <Text style={styles.addressText}>
              Position sélectionnée:{" "}
              {selectedLocation
                ? `Lat: ${selectedLocation.latitude}, Lng: ${selectedLocation.longitude}`
                : "Aucune position sélectionnée"}
            </Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmMapLocation}
            >
              <Text style={styles.confirmButtonText}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>
          {mode === "cash"
            ? "Choisir un emplacement de récupération"
            : "Choisir une adresse de livraison"}
        </Text>

        <View style={styles.modeButtons}>
          {["list", "manual", "map"].map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.modeButton,
                selectionMode === mode && styles.modeButtonSelected,
              ]}
              onPress={() => setSelectionMode(mode)}
            >
              <Text style={styles.modeButtonText}>
                {mode === "list"
                  ? "Liste"
                  : mode === "manual"
                    ? "Saisie manuelle"
                    : "Carte"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {renderSelectionMode()}
      </ScrollView>

      <View style={styles.navBar}>
        {[
          { name: "home", text: "Catalogue", screen: "Catalog" },
          { name: "cart", text: "Panier", screen: "Cart" },
          { name: "star", text: "Promotions", screen: "Promotions" },
          { name: "heart", text: "Fidélité", screen: "Loyalty" },
          { name: "location", text: "Suivi", screen: "Tracking" },
          { name: "person", text: "Profil", screen: "Profile" },
        ].map((item) => (
          <TouchableOpacity
            key={item.screen}
            style={styles.navItem}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Ionicons name={item.name} size={24} color="#666" />
            <Text style={styles.navText}>{item.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  content: {
    padding: 16,
    paddingBottom: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E1E1E",
    marginBottom: 24,
    textAlign: "center",
  },
  modeButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E8ECEF",
    alignItems: "center",
  },
  modeButtonSelected: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  modeButtonText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  selectionContainer: {
    flex: 1,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E1E1E",
    marginBottom: 12,
  },
  list: {
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8ECEF",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  locationDetails: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E1E1E",
  },
  locationCoords: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },
  manualInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8ECEF",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: "top",
  },
  map: {
    height: 300,
    marginBottom: 16,
    borderRadius: 8,
    overflow: "hidden",
  },
  addressText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginVertical: 20,
  },
  confirmButton: {
    backgroundColor: "#28a745",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  navItem: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  navText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
});

export default LocationSelectionScreen;
