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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  applyPromotion,
  createOrder,
  getUserOrderHistory,
} from "../../services/api";

const CartScreen = ({ route, navigation }) => {
  const {
    cart: initialCart = [],
    setCart: setGlobalCart,
    discount: initialDiscount = 0,
  } = route.params || {};
  console.log("Route params received:", route.params);
  const [cart, setCart] = useState(initialCart);
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(initialDiscount);

  useEffect(() => {
    const loadCart = async () => {
      try {
        const savedCart = await AsyncStorage.getItem("cart");
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart);
          setCart(parsedCart);
          if (setGlobalCart) setGlobalCart(parsedCart);
        } else if (initialCart.length > 0) {
          setCart(initialCart);
          if (setGlobalCart) setGlobalCart(initialCart);
        } else {
          const response = await getUserOrderHistory();
          const orders = response.data.orders || [];
          const pendingOrder = orders.find(
            (order) => order.status === "pending",
          ) || { products: [] };
          const backendCart = pendingOrder.products.map((item) => ({
            productId: item.productId._id,
            quantity: item.quantity,
            locationId: item.locationId,
            alternativeLocationId: item.alternativeLocationId,
            product: item.productId,
            comment: item.comment || "", // Ajout du commentaire depuis le backend
          }));
          if (backendCart.length > 0) {
            setCart(backendCart);
            await AsyncStorage.setItem("cart", JSON.stringify(backendCart));
            if (setGlobalCart) setGlobalCart(backendCart);
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement du panier:", error);
        setCart(initialCart || []);
        if (setGlobalCart) setGlobalCart(initialCart || []);
        Alert.alert("Erreur", "Impossible de charger le panier");
      }
    };
    loadCart();
  }, [initialCart, setGlobalCart]);

  useEffect(() => {
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem("cart", JSON.stringify(cart));
        if (setGlobalCart) setGlobalCart(cart);
      } catch (error) {
        console.error("Erreur lors de la sauvegarde du panier:", error);
      }
    };
    if (cart.length > 0) saveCart();
  }, [cart, setGlobalCart]);

  const handleQuantityChange = async (productId, change) => {
    try {
      const updatedCart = cart
        .map((item) => {
          if (item.productId === productId) {
            const newQuantity = item.quantity + change;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
          }
          return item;
        })
        .filter((item) => item !== null);

      await createOrder({
        products: updatedCart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          locationId: item.locationId,
          alternativeLocationId: item.alternativeLocationId,
          comment: item.comment || "",
        })),
        status: "pending",
      });

      setCart(updatedCart);
      if (setGlobalCart) setGlobalCart(updatedCart);
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la quantité:", error);
      Alert.alert("Erreur", "Impossible de modifier la quantité");
    }
  };

  const handleRemoveProduct = async (productId) => {
    try {
      const updatedCart = cart.filter((item) => item.productId !== productId);

      await createOrder({
        products: updatedCart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          locationId: item.locationId,
          alternativeLocationId: item.alternativeLocationId,
          comment: item.comment || "",
        })),
        status: "pending",
      });

      setCart(updatedCart);
      if (setGlobalCart) setGlobalCart(updatedCart);
      Alert.alert("Succès", "Produit retiré du panier");
    } catch (error) {
      console.error("Erreur lors de la suppression du produit:", error);
      Alert.alert("Erreur", "Impossible de supprimer le produit");
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCode) {
      Alert.alert("Erreur", "Veuillez entrer un code promo");
      return;
    }
    try {
      const orderData = {
        products: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          locationId: item.locationId,
          alternativeLocationId: item.alternativeLocationId,
          comment: item.comment || "",
        })),
        supermarketId: cart[0]?.product?.supermarketId || null,
        locationId: cart[0]?.locationId,
      };
      const response = await applyPromotion({
        orderId: "temp-" + Date.now(),
        promoCode,
        orderData,
      });
      const discountAmount = response.data.discount || 0;
      setDiscount(discountAmount);
      Alert.alert(
        "Succès",
        `Promotion appliquée ! Réduction de ${discountAmount} FCFA`,
      );

      await createOrder({
        products: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          locationId: item.locationId,
          alternativeLocationId: item.alternativeLocationId,
          comment: item.comment || "",
        })),
        discount: discountAmount,
        promoCode,
        status: "pending",
      });
    } catch (error) {
      console.error("Erreur lors de l'application de la promotion:", error);
      Alert.alert(
        "Erreur",
        error.response?.data?.message || "Impossible d'appliquer la promotion",
      );
    }
  };

  const handleCommentChange = (productId, comment) => {
    const updatedCart = cart.map((item) =>
      item.productId === productId ? { ...item, comment } : item,
    );
    setCart(updatedCart);
  };

  const renderProduct = ({ item }) => {
    const product = item.product || {};
    const additionalFee = item.alternativeLocationId ? 200 + 50 * 4 : 0;

    return (
      <View style={styles.productItem}>
        <View style={styles.productDetails}>
          <Text style={styles.productName}>
            {product.name || "Produit inconnu"}
          </Text>
          <Text style={styles.productPrice}>
            {product.price || 0} FCFA x {item.quantity}
          </Text>
          {additionalFee > 0 && (
            <Text style={styles.additionalFeeText}>
              Frais supplémentaires : +{additionalFee} FCFA
            </Text>
          )}
          <TextInput
            style={styles.commentInput}
            value={item.comment || ""}
            onChangeText={(text) => handleCommentChange(item.productId, text)}
            placeholder="Ajouter un commentaire..."
            placeholderTextColor="#B0B0B0"
            multiline
          />
        </View>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            onPress={() => handleQuantityChange(item.productId, -1)}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity
            onPress={() => handleQuantityChange(item.productId, 1)}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => handleRemoveProduct(item.productId)}
          style={styles.removeButton}
        >
          <Ionicons name="trash" size={24} color="#dc3545" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSummary = () => {
    const subtotal = cart.reduce(
      (total, item) => total + (item.product?.price || 0) * item.quantity,
      0,
    );
    const deliveryFee = 500;
    const additionalFees = cart.reduce(
      (total, item) => total + (item.alternativeLocationId ? 300 : 0),
      0,
    );
    const total = subtotal + deliveryFee + additionalFees - discount;

    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Résumé de la Commande</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sous-total :</Text>
          <Text style={styles.summaryValue}>{subtotal} FCFA</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Frais de livraison :</Text>
          <Text style={styles.summaryValue}>{deliveryFee} FCFA</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Frais supplémentaires :</Text>
          <Text style={styles.summaryValue}>{additionalFees} FCFA</Text>
        </View>
        {discount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Réduction (Promo) :</Text>
            <Text style={styles.summaryValue}>-{discount} FCFA</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total :</Text>
          <Text style={styles.summaryValue}>{total} FCFA</Text>
        </View>
        <View style={styles.promoContainer}>
          <TextInput
            style={styles.promoInput}
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder="Entrez un code promo..."
            placeholderTextColor="#B0B0B0"
          />
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApplyPromo}
          >
            <Text style={styles.applyButtonText}>Appliquer</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.validateButton}
          onPress={() =>
            navigation.navigate("Payment", {
              cart,
              initialDiscount: discount,
              promoCode: discount > 0 ? promoCode : "",
              setCart: setGlobalCart,
            })
          }
        >
          <Text style={styles.validateButtonText}>Passer au Paiement</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Votre Panier</Text>
        {cart.length > 0 ? (
          <FlatList
            data={cart}
            renderItem={renderProduct}
            keyExtractor={(item) => item.productId}
            style={styles.list}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <Text style={styles.emptyText}>Votre panier est vide</Text>
        )}
        {cart.length > 0 && renderSummary()}
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Catalog")}
        >
          <Ionicons name="home" size={24} color="#666" />
          <Text style={styles.navText}>Catalogue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="cart" size={24} color="#007bff" />
          <Text style={styles.navText}>Panier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            navigation.navigate("Promotions", { cart, setCart: setGlobalCart })
          }
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
  list: {
    marginBottom: 15,
  },
  listContent: {
    paddingBottom: 10,
  },
  productItem: {
    flexDirection: "row",
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
    alignItems: "center",
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E1E1E",
    fontFamily: "Roboto-Medium",
  },
  productPrice: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
    fontFamily: "Roboto-Regular",
  },
  additionalFeeText: {
    fontSize: 12,
    color: "#FF4444",
    marginTop: 5,
    fontFamily: "Roboto-Regular",
  },
  commentInput: {
    marginTop: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E8ECEF",
    borderRadius: 8,
    fontSize: 14,
    color: "#333",
    fontFamily: "Roboto-Regular",
    backgroundColor: "#F9F9F9",
    maxHeight: 60,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
  },
  quantityButton: {
    backgroundColor: "#007bff",
    padding: 5,
    borderRadius: 5,
    width: 30,
    alignItems: "center",
  },
  quantityButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Roboto-Bold",
  },
  quantityText: {
    fontSize: 16,
    marginHorizontal: 10,
    fontFamily: "Roboto-Regular",
  },
  removeButton: {
    padding: 5,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
    fontFamily: "Roboto-Regular",
  },
  summaryContainer: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECEF",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginTop: 10,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    color: "#1E1E1E",
    fontFamily: "Roboto-Medium",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Roboto-Regular",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    fontFamily: "Roboto-Medium",
  },
  promoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 15,
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
  validateButton: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  validateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Roboto-Bold",
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
    fontFamily: "Roboto-Regular",
  },
});

export default CartScreen;
