import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Pressable,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getPromotions, applyPromotion, getCart } from "../../services/api";

const PromotionScreen = ({ navigation, route }) => {
  const { cart: initialCart = [], setCart: setGlobalCart } = route.params || {};
  const [promotions, setPromotions] = useState([]);
  const [promoCode, setPromoCode] = useState("");
  const [cart, setCart] = useState(initialCart);
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const response = await getPromotions();
        setPromotions(response.data || []);
      } catch (error) {
        Alert.alert(
          "Erreur",
          "Impossible de charger les promotions pour le moment",
        );
      }
    };

    const fetchCart = async () => {
      try {
        const cartResponse = await getCart();
        const cartData = cartResponse.data || [];
        if (cartData.length > 0) {
          setCart(cartData);
          setOrderId("current-cart");
          if (setGlobalCart) setGlobalCart(cartData);
        } else {
          setCart([]);
          setOrderId("");
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du panier:", error);
        setCart([]);
        setOrderId("");
      }
    };

    fetchPromotions();
    fetchCart();
  }, [setGlobalCart]);

  const handleApplyPromotion = async () => {
    if (!promoCode || !orderId) {
      Alert.alert(
        "Erreur",
        "Veuillez entrer un code promo et avoir une commande active",
      );
      return;
    }

    try {
      const orderData = {
        products: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          locationId: item.locationId,
          alternativeLocationId: item.alternativeLocationId,
        })),
        supermarketId: cart[0]?.product?.supermarketId || null,
        locationId: cart[0]?.locationId,
      };

      const response = await applyPromotion({
        orderId,
        promoCode,
        orderData,
      });

      const discountAmount = response.data.discount || 0;
      Alert.alert(
        "Succès",
        `Promotion appliquée ! Réduction de ${discountAmount} FCFA`,
      );
      setPromoCode("");

      navigation.navigate("Cart", {
        cart,
        setCart: setGlobalCart,
        discount: discountAmount,
      });
    } catch (error) {
      console.error("Erreur lors de l'application de la promotion:", error);
      Alert.alert(
        "Erreur",
        error.response?.data?.message || "Impossible d'appliquer la promotion",
      );
    }
  };

  const renderPromotion = ({ item }) => (
    <View style={styles.promotionCard}>
      <Text style={styles.promotionTitle}>{item.title}</Text>
      <Text style={styles.promotionDescription}>{item.description}</Text>
      <View style={styles.promotionDetails}>
        <Text style={styles.promotionDiscount}>
          Réduction :{" "}
          {item.discountType === "percentage"
            ? `${item.discountValue}%`
            : `${item.discountValue} FCFA`}
        </Text>
        <Text style={styles.promotionCode}>Code : {item.code}</Text>
      </View>
      <Text style={styles.promotionDates}>
        Valide du {new Date(item.startDate).toLocaleDateString()} au{" "}
        {new Date(item.endDate).toLocaleDateString()}
      </Text>
      {item.minOrderAmount > 0 && (
        <Text style={styles.promotionMinAmount}>
          Montant minimum : {item.minOrderAmount} FCFA
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Promotions Actives</Text>

        <View style={styles.applyPromoContainer}>
          <TextInput
            style={styles.promoInput}
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder="Entrez le code promo..."
            placeholderTextColor="#B0B0B0"
          />
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApplyPromotion}
          >
            <Text style={styles.applyButtonText}>Appliquer</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={promotions}
          renderItem={renderPromotion}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucune promotion active</Text>
          }
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      </View>

      <View style={styles.navBar}>
        <Pressable
          style={styles.navItem}
          onPress={() => navigation.navigate("Catalog")}
        >
          <Ionicons name="home" size={24} color="#666" />
          <Text style={styles.navText}>Catalogue</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() =>
            navigation.navigate("Cart", { cart, setCart: setGlobalCart })
          }
        >
          <View style={styles.cartContainer}>
            <Ionicons name="cart" size={24} color="#666" />
          </View>
          <Text style={styles.navText}>Panier</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <Ionicons name="star" size={24} color="#007bff" />
          <Text style={styles.navText}>Promotions</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => navigation.navigate("Loyalty")}
        >
          <Ionicons name="heart" size={24} color="#666" />
          <Text style={styles.navText}>Fidélité</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => navigation.navigate("Tracking")}
        >
          <Ionicons name="location" size={24} color="#666" />
          <Text style={styles.navText}>Suivi</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person" size={24} color="#666" />
          <Text style={styles.navText}>Profil</Text>
        </Pressable>
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
    flex: 1,
    padding: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E1E1E",
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "Roboto-Bold",
  },
  applyPromoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  promoInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: "#333",
    fontFamily: "Roboto-Regular",
  },
  applyButton: {
    backgroundColor: "#FF2D55",
    borderRadius: 20,
    padding: 10,
    marginLeft: 10,
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Roboto-Bold",
  },
  list: {
    marginBottom: 15,
  },
  listContent: {
    paddingBottom: 10,
  },
  promotionCard: {
    padding: 15,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8ECEF",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  promotionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E1E1E",
    marginBottom: 5,
    fontFamily: "Roboto-Medium",
  },
  promotionDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontFamily: "Roboto-Regular",
  },
  promotionDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  promotionDiscount: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FF2D55",
    fontFamily: "Roboto-Medium",
  },
  promotionCode: {
    fontSize: 14,
    fontWeight: "500",
    color: "#007bff",
    fontFamily: "Roboto-Medium",
  },
  promotionDates: {
    fontSize: 12,
    color: "#888",
    fontFamily: "Roboto-Regular",
  },
  promotionMinAmount: {
    fontSize: 12,
    color: "#888",
    marginTop: 5,
    fontFamily: "Roboto-Regular",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
    fontFamily: "Roboto-Regular",
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
  cartContainer: {
    position: "relative",
  },
  navText: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
    fontFamily: "Roboto-Regular",
  },
});

export default PromotionScreen;
