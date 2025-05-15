import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapWrapper from "../../components/MapWrapper";
const { MapView, Marker } = MapWrapper;
import * as Location from "expo-location";
import { createOrder, createPayment } from "../../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PaymentScreen = ({ route, navigation }) => {
  const {
    cart: initialCart = [],
    initialDiscount = 0,
    promoCode = "",
    setCart: setGlobalCart,
    selectedAddress,
  } = route.params || { cart: [], initialDiscount: 0, promoCode: "" };
  const [cart, setCart] = useState(initialCart);
  const [paymentMethod, setPaymentMethod] = useState("wallet");
  const [deliveryMethod, setDeliveryMethod] = useState("standard");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(
    selectedAddress || {
      address: "Adresse par défaut",
      lat: 6.1725,
      lng: 1.2314,
    },
  );
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
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
          "L'accès à la localisation est nécessaire pour suggérer une adresse de livraison.",
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

    requestLocationPermission();
  }, []);

  const calculateSubtotal = () => {
    return cart.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0,
    );
  };

  const calculateServiceFee = () => {
    return calculateSubtotal() * 0.1;
  };

  const getDeliveryFee = () => {
    const baseFee =
      {
        standard: 500,
        evening: 400,
        express: 500,
        pickup: 500,
      }[deliveryMethod] || 500;
    const totalWeight = cart.reduce(
      (total, item) => total + (item.product.weight || 1) * item.quantity,
      0,
    );
    const weightFee =
      deliveryMethod === "pickup" ? 0 : Math.max(totalWeight - 5, 0) * 50;
    const distanceFee = 100;
    return (
      baseFee +
      weightFee +
      (deliveryMethod !== "pickup" && deliveryMethod !== "evening"
        ? distanceFee
        : 0)
    );
  };

  const calculateTotal = () => {
    return (
      calculateSubtotal() +
      calculateServiceFee() +
      getDeliveryFee() -
      initialDiscount
    );
  };

  const handleConfirmAddress = () => {
    if (!selectedLocation) {
      Alert.alert("Erreur", "Veuillez sélectionner une adresse de livraison.");
      return;
    }

    setDeliveryAddress({
      address: "Adresse sélectionnée",
      lat: selectedLocation.latitude,
      lng: selectedLocation.longitude,
    });
    setShowAddressModal(false);
    handlePayment();
  };

  const handlePayment = async () => {
    if (
      paymentMethod !== "wallet" &&
      paymentMethod !== "cash" &&
      !phoneNumber
    ) {
      Alert.alert(
        "Erreur",
        "Veuillez entrer un numéro de téléphone pour Flooz/TMoney",
      );
      return;
    }

    try {
      const orderData = {
        products: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          locationId: item.locationId,
          comment: item.comment || "",
        })),
        supermarketId: cart[0]?.product.supermarketId || null,
        locationId: cart[0]?.locationId,
        deliveryAddress: deliveryAddress,
        scheduledDeliveryTime: new Date(Date.now() + 60 * 60 * 1000),
        deliveryType: deliveryMethod,
        deliveryFee: getDeliveryFee(),
        totalAmount: calculateTotal(),
        discount: initialDiscount,
        promoCode,
      };
      const orderResponse = await createOrder(orderData);
      const orderId = orderResponse.data._id;

      const paymentData = {
        orderId,
        method: paymentMethod,
        clientPhone:
          paymentMethod !== "wallet" && paymentMethod !== "cash"
            ? phoneNumber
            : undefined,
        amount: calculateTotal(),
      };

      if (paymentMethod === "cash") {
        navigation.navigate("LocationSelectionScreen", {
          orderId,
          paymentData,
          mode: "cash",
        });
        return;
      }

      const paymentResponse = await createPayment(paymentData);
      if (paymentResponse.status === 201) {
        Alert.alert("Succès", "Paiement effectué avec succès");
        setCart([]);
        if (setGlobalCart) setGlobalCart([]);
        await AsyncStorage.setItem("cart", JSON.stringify([]));
        navigation.navigate("Catalog");
      }
    } catch (error) {
      console.error("Erreur lors du paiement:", error);
      Alert.alert(
        "Erreur",
        error.response?.data?.message || "Erreur lors du paiement",
      );
    }
  };

  const handleConfirmAndPay = () => {
    setShowAddressModal(true);
  };

  const renderProduct = ({ item }) => {
    const product = item.product;
    const unitPrice = product.price;
    const quantity = item.quantity;
    const totalPrice = unitPrice * quantity;
    return (
      <View style={styles.receiptItem}>
        <Text style={[styles.receiptText, styles.receiptTextProduct]}>
          {product.name}
        </Text>
        <Text style={styles.receiptText}>{quantity}</Text>
        <Text style={styles.receiptText}>{unitPrice} FCFA</Text>
        <Text style={styles.receiptText}>{totalPrice} FCFA</Text>
        <Text style={styles.receiptText}>{item.comment || "-"}</Text>
      </View>
    );
  };

  const renderReceipt = () => {
    const subtotal = calculateSubtotal();
    const serviceFee = calculateServiceFee();
    const deliveryFee = getDeliveryFee();
    const total = calculateTotal();

    return (
      <View style={styles.receiptCard}>
        <Text style={styles.receiptHeader}>
          Récapitulatif de votre commande
        </Text>
        <View style={styles.receiptHeaderRow}>
          <Text
            style={[styles.receiptHeaderText, styles.receiptHeaderTextProduct]}
          >
            Produit
          </Text>
          <Text style={styles.receiptHeaderText}>Qté</Text>
          <Text style={styles.receiptHeaderText}>Prix unitaire</Text>
          <Text style={styles.receiptHeaderText}>Prix total</Text>
          <Text style={styles.receiptHeaderText}>Commentaires</Text>
        </View>
        <FlatList
          data={cart}
          renderItem={renderProduct}
          keyExtractor={(item) => item.productId}
          style={styles.receiptList}
        />
        <View style={styles.receiptSummary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total :</Text>
            <Text style={styles.summaryValue}>{subtotal} FCFA</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frais de service (10%) :</Text>
            <Text style={styles.summaryValue}>
              {serviceFee.toFixed(0)} FCFA
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frais de livraison :</Text>
            <Text style={styles.summaryValue}>{deliveryFee} FCFA</Text>
          </View>
          {initialDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Réduction :</Text>
              <Text style={[styles.summaryValue, styles.discountText]}>
                -{initialDiscount} FCFA
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelTotal}>Total :</Text>
            <Text style={styles.summaryValueTotal}>
              {total.toFixed(0)} FCFA
            </Text>
          </View>
        </View>
        <Text style={styles.receiptFooter}>
          Merci d'avoir choisi nos services !
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.supermarketName}></Text>

          {renderReceipt()}

          <Text style={styles.sectionTitle}>Choisir votre livraison</Text>
          <View style={styles.deliveryCards}>
            <TouchableOpacity
              style={[
                styles.deliveryCard,
                deliveryMethod === "standard" && styles.deliveryCardSelected,
              ]}
              onPress={() => setDeliveryMethod("standard")}
            >
              <Text style={styles.deliveryCardText}>Livraison Standard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.deliveryCard,
                deliveryMethod === "evening" && styles.deliveryCardSelected,
              ]}
              onPress={() => setDeliveryMethod("evening")}
            >
              <Text style={styles.deliveryCardText}>Livraison Groupée</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.deliveryCard,
                deliveryMethod === "pickup" && styles.deliveryCardSelected,
              ]}
              onPress={() => setDeliveryMethod("pickup")}
            >
              <Text style={styles.deliveryCardText}>
                Récupération en magasin
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>
            Choisir votre moyen de paiement
          </Text>
          <View style={styles.paymentCards}>
            <TouchableOpacity
              style={[
                styles.paymentCard,
                paymentMethod === "Flooz" && styles.paymentCardSelected,
              ]}
              onPress={() => setPaymentMethod("Flooz")}
            >
              <Text style={styles.paymentCardText}>Flooz</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.paymentCard,
                paymentMethod === "TMoney" && styles.paymentCardSelected,
              ]}
              onPress={() => setPaymentMethod("TMoney")}
            >
              <Text style={styles.paymentCardText}>TMoney</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.paymentCard,
                paymentMethod === "wallet" && styles.paymentCardSelected,
              ]}
              onPress={() => setPaymentMethod("wallet")}
            >
              <Text style={styles.paymentCardText}>Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.paymentCard,
                paymentMethod === "cash" && styles.paymentCardSelected,
              ]}
              onPress={() => setPaymentMethod("cash")}
            >
              <Text style={styles.paymentCardText}>Cash</Text>
            </TouchableOpacity>
          </View>

          {paymentMethod !== "wallet" && paymentMethod !== "cash" && (
            <View style={styles.phoneContainer}>
              <Text style={styles.label}>Numéro de téléphone</Text>
              <TextInput
                style={styles.input}
                placeholder="Entrez votre numéro"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.fixedButtonContainer}>
        <TouchableOpacity
          style={styles.payButton}
          onPress={handleConfirmAndPay}
        >
          <Text style={styles.payButtonText}>Confirmer et Payer</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showAddressModal}
        transparent={false}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Choisir l'adresse de livraison</Text>
          {currentLocation ? (
            <MapView
              style={styles.map}
              initialRegion={currentLocation}
              onPress={(e) => setSelectedLocation(e.nativeEvent.coordinate)}
            >
              {selectedLocation && <Marker coordinate={selectedLocation} />}
            </MapView>
          ) : (
            <Text style={styles.loadingText}>Chargement de la localisation...</Text>
          )}
          <Text style={styles.addressText}>
            Adresse sélectionnée :{" "}
            {selectedLocation
              ? `Lat: ${selectedLocation.latitude}, Lng: ${selectedLocation.longitude}`
              : "Aucune adresse sélectionnée"}
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleConfirmAddress}
            >
              <Text style={styles.modalButtonText}>Confirmer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.alternativeButton]}
              onPress={() =>
                navigation.navigate("LocationSelectionScreen", {
                  mode: "address",
                  cart,
                  initialDiscount,
                  promoCode,
                  setCart: setGlobalCart,
                })
              }
            >
              <Text style={styles.modalButtonText}>
                Choisir une autre adresse
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowAddressModal(false)}
            >
              <Text style={styles.modalButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Catalog")}
        >
          <Ionicons name="home" size={24} color="#666" />
          <Text style={styles.navText}>Catalogue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            navigation.navigate("Cart", {
              cart,
              setCart: setGlobalCart,
              discount: initialDiscount,
            })
          }
        >
          <Ionicons name="cart" size={24} color="#666" />
          <Text style={styles.navText}>Panier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Promotions")}
        >
          <Ionicons name="star" size={24} color="#666" />
          <Text style={styles.navText}>Promotions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Loyalty")}
        >
          <Ionicons name="heart" size={24} color="#666" />
          <Text style={styles.navText}>Fidélité</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Tracking")}
        >
          <Ionicons name="location" size={24} color="#666" />
          <Text style={styles.navText}>Suivi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person" size={24} color="#666" />
          <Text style={styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    padding: 15,
  },
  supermarketName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FF2D55",
    marginBottom: 20,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E1E1E",
    marginBottom: 10,
    marginTop: 20,
  },
  receiptCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E8ECEF",
  },
  receiptHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E1E1E",
    textAlign: "center",
    marginBottom: 15,
  },
  receiptHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingBottom: 8,
    marginBottom: 10,
  },
  receiptHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    flex: 1,
    textAlign: "center",
  },
  receiptHeaderTextProduct: {
    flex: 2,
    textAlign: "left",
  },
  receiptList: {
    marginBottom: 15,
  },
  receiptItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E8ECEF",
  },
  receiptText: {
    fontSize: 14,
    color: "#1E1E1E",
    flex: 1,
    textAlign: "center",
  },
  receiptTextProduct: {
    flex: 2,
    textAlign: "left",
  },
  receiptSummary: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  discountText: {
    color: "#FF2D55",
  },
  summaryLabelTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1E1E",
  },
  summaryValueTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1E1E",
  },
  receiptFooter: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    marginTop: 15,
  },
  deliveryCards: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  deliveryCard: {
    flex: 1,
    padding: 15,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: "#E8ECEF",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  deliveryCardSelected: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  deliveryCardText: {
    fontSize: 14,
    color: "#333",
  },
  paymentCards: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  paymentCard: {
    width: "48%",
    padding: 15,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E8ECEF",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  paymentCardSelected: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  paymentCardText: {
    fontSize: 16,
    color: "#333",
  },
  phoneContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#333",
    marginBottom: 5,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8ECEF",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  fixedButtonContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 80 : 60,
    left: 0,
    right: 0,
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  payButton: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E1E1E",
    textAlign: "center",
    marginBottom: 15,
  },
  map: {
    height: 300,
    marginBottom: 15,
  },
  addressText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: "column",
    justifyContent: "space-between",
  },
  modalButton: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 5,
  },
  alternativeButton: {
    backgroundColor: "#007bff",
  },
  cancelButton: {
    backgroundColor: "#dc3545",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginVertical: 20,
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  navItem: {
    alignItems: "center",
  },
  navText: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
  },
});

export default PaymentScreen;
