import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  SafeAreaView,
  TextInput,
  Dimensions,
  Pressable,
  Picker,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getSupermarkets,
  getSupermarket,
  getProducts,
  getProductById,
  createNotification,
} from "../../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

const CatalogScreen = ({ navigation }) => {
  const [supermarkets, setSupermarkets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [showRupturePopup, setShowRupturePopup] = useState(false);
  const [ruptureProduct, setRuptureProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [currentStep, setCurrentStep] = useState("supermarkets");
  const [selectedSupermarket, setSelectedSupermarket] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const userLocation = { latitude: 6.1319, longitude: 1.222 };

  const fetchSupermarkets = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      console.log("Token:", token);
      const response = await getSupermarkets();
      console.log("Réponse API complète:", response);
      const supermarketData = response.data?.data || [];
      if (Array.isArray(supermarketData) && supermarketData.length > 0) {
        setSupermarkets(supermarketData);
      } else {
        console.warn("Aucun supermarché trouvé");
        setSupermarkets([]);
        Alert.alert(
          "Information",
          "Aucun supermarché disponible pour le moment",
        );
      }
    } catch (error) {
      console.error("Erreur API:", error.response?.data || error.message);
      Alert.alert(
        "Erreur",
        error.response?.data?.message ||
          "Impossible de charger les supermarchés",
      );
    }
  };

  const fetchLocations = async (supermarketId) => {
    try {
      const response = await getSupermarket(supermarketId);
      console.log("Réponse API getSupermarket:", response.data);
      let locationsData = response.data?.locations || [];
      locationsData.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.latitude - userLocation.latitude, 2) +
            Math.pow(a.longitude - userLocation.longitude, 2),
        );
        const distB = Math.sqrt(
          Math.pow(b.latitude - userLocation.latitude, 2) +
            Math.pow(b.longitude - userLocation.longitude, 2),
        );
        return distA - distB;
      });
      setLocations(locationsData);
    } catch (error) {
      console.error("Erreur lors de la récupération des sites:", error.message);
      setLocations([]);
    }
  };

  const fetchProducts = async () => {
    try {
      console.log("selectedSupermarket:", selectedSupermarket);
      console.log("selectedLocation:", selectedLocation);
      console.log("selectedCategory:", selectedCategory);
      const response = await getProducts(
        selectedSupermarket,
        selectedLocation,
        selectedCategory === "Tous" ? null : selectedCategory,
      );
      console.log("Données brutes de getProducts:", response.data);
      let filteredProducts =
        response.data && Array.isArray(response.data) ? response.data : [];

      // Filtrage côté client par searchQuery
      if (searchQuery) {
        filteredProducts = filteredProducts.filter((product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      }

      console.log("Produits après filtrage:", filteredProducts);
      setProducts(filteredProducts);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des produits:",
        error.message,
      );
      setProducts([]);
    }
  };

  useEffect(() => {
    const loadCart = async () => {
      try {
        const savedCart = await AsyncStorage.getItem("cart");
        if (savedCart) {
          setCart(JSON.parse(savedCart));
        }
      } catch (error) {
        console.error("Erreur lors du chargement du panier:", error);
      }
    };
    loadCart();

    if (currentStep === "supermarkets") {
      fetchSupermarkets();
    } else if (currentStep === "locations" && selectedSupermarket) {
      fetchLocations(selectedSupermarket);
    } else if (
      currentStep === "products" &&
      selectedSupermarket &&
      selectedLocation
    ) {
      fetchProducts();
    }
  }, [currentStep, selectedSupermarket, selectedLocation]);

  useEffect(() => {
    if (currentStep === "products" && selectedSupermarket && selectedLocation) {
      fetchProducts();
    }
  }, [searchQuery, selectedCategory]);

  const handleAddToCart = async (productId) => {
    try {
      const productResponse = await getProductById(productId);
      const product = productResponse.data;
      const stockEntry = product.stockByLocation.find(
        (stock) => stock.locationId === selectedLocation,
      );
      const stock = stockEntry ? stockEntry.stock : 0;

      if (stock > 0) {
        const existingProduct = cart.find(
          (item) => item.productId === productId,
        );
        let updatedCart;
        if (existingProduct) {
          updatedCart = cart.map((item) =>
            item.productId === productId
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        } else {
          updatedCart = [
            ...cart,
            {
              productId: product._id,
              quantity: 1,
              locationId: selectedLocation,
              product,
            },
          ];
        }
        setCart(updatedCart);
        await AsyncStorage.setItem("cart", JSON.stringify(updatedCart));
        Alert.alert("Succès", `${product.name} ajouté au panier`);
      } else {
        setRuptureProduct(product);
        setShowRupturePopup(true);
      }
    } catch (error) {
      console.error("Erreur lors de la vérification du stock:", error);
      Alert.alert("Erreur", "Impossible de vérifier le stock");
    }
  };

  const handleNotifyRupture = async () => {
    if (ruptureProduct) {
      try {
        await createNotification({
          userId: await AsyncStorage.getItem("userId"),
          message: `Rupture de stock pour ${ruptureProduct.name} au site ${selectedLocation}`,
          type: "stock",
          productId: ruptureProduct._id,
        });
        Alert.alert("Succès", "Notification envoyée avec succès");
        setShowRupturePopup(false);
      } catch (error) {
        console.error("Erreur lors de l'envoi de la notification:", error);
        Alert.alert("Erreur", "Impossible d'envoyer la notification");
      }
    }
  };

  const renderSupermarket = ({ item }) => (
    <Pressable
      style={({ pressed }) => [
        styles.supermarketItem,
        pressed && styles.supermarketItemPressed,
      ]}
      onPress={() => {
        setSelectedSupermarket(item._id);
        setCurrentStep("locations");
      }}
    >
      <Text style={styles.itemText}>{item.name}</Text>
      <Text style={styles.subText}>Plan: {item.subscriptionPlan}</Text>
      <Text style={styles.subText}>{item.locations?.length || 0} site(s)</Text>
    </Pressable>
  );

  const renderLocation = ({ item }) => (
    <Pressable
      style={({ pressed }) => [
        styles.locationItem,
        pressed && styles.locationItemPressed,
      ]}
      onPress={() => {
        setSelectedLocation(item._id);
        setCurrentStep("products");
      }}
    >
      <Text style={styles.itemText}>{item.name}</Text>
      <Text style={styles.subText}>
        {item.address || "Adresse non disponible"}
      </Text>
    </Pressable>
  );

  const renderProduct = ({ item }) => {
    const stockEntry = item.stockByLocation.find(
      (stock) => stock.locationId === selectedLocation,
    );
    const stock = stockEntry ? stockEntry.stock : 0;
    console.log(
      `Stock de ${item.name} pour location ${selectedLocation}:`,
      stock,
    );

    return (
      <View style={styles.productCard}>
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>Image indisponible</Text>
        </View>
        <Text style={styles.productName}>{item.name}</Text>
        <View style={styles.productDetails}>
          <Text style={styles.productPrice}>{item.price} FCFA</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddToCart(item._id)}
          >
            <Text style={styles.addButtonText}>Ajouter</Text>
          </TouchableOpacity>
        </View>
        {stock === 0 && <Text style={styles.stockOut}>Stock épuisé</Text>}
      </View>
    );
  };

  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un produit..."
            placeholderTextColor="#B0B0B0"
            editable={currentStep === "products"}
          />
          <Pressable style={styles.searchButton}>
            <Ionicons name="search" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        {currentStep === "supermarkets" && (
          <>
            <Text style={styles.title}>Supermarchés</Text>
            <FlatList
              data={supermarkets}
              renderItem={renderSupermarket}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Aucun supermarché trouvé</Text>
              }
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          </>
        )}
        {currentStep === "locations" && (
          <>
            <Text style={styles.title}>Sites (par proximité)</Text>
            <FlatList
              data={locations}
              renderItem={renderLocation}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Aucun site trouvé</Text>
              }
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          </>
        )}
        {currentStep === "products" && (
          <>
            <View style={styles.locationBanner}>
              <Text style={styles.locationText}>
                Site :{" "}
                {locations.find((loc) => loc._id === selectedLocation)?.name ||
                  "Inconnu"}
              </Text>
            </View>
            <Text style={styles.title}>Catégories</Text>
            <Picker
              selectedValue={selectedCategory}
              onValueChange={(itemValue) => setSelectedCategory(itemValue)}
              style={styles.categoryPicker}
            >
              <Picker.Item label="Tous" value="Tous" />
              <Picker.Item label="Fruits" value="Fruits" />
              <Picker.Item label="Légumes" value="Légumes" />
              <Picker.Item label="Viandes" value="Viandes" />
              <Picker.Item
                label="Produits Laitiers"
                value="Produits Laitiers"
              />
              <Picker.Item label="Épicerie" value="Épicerie" />
              <Picker.Item label="Boissons" value="Boissons" />
              <Picker.Item label="Céréales" value="Céréales" />
              <Picker.Item label="Autres" value="Autres" />
            </Picker>
            <Text style={styles.title}>Produits</Text>
            <FlatList
              data={products}
              renderItem={renderProduct}
              keyExtractor={(item) => item._id}
              numColumns={2}
              columnWrapperStyle={styles.productRow}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Aucun produit trouvé</Text>
              }
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          </>
        )}
      </View>

      <Modal
        transparent={true}
        visible={showRupturePopup}
        onRequestClose={() => setShowRupturePopup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rupturePopup}>
            <Text style={styles.popupTitle}>Rupture de Stock</Text>
            <Text style={styles.popupSubtitle}>
              Le produit {ruptureProduct?.name} est actuellement en rupture de
              stock à ce site.
            </Text>
            <Pressable
              style={styles.optionButton}
              onPress={handleNotifyRupture}
            >
              <Text style={styles.optionText}>Notifier la rupture</Text>
            </Pressable>
            <Pressable
              style={styles.closeButton}
              onPress={() => setShowRupturePopup(false)}
            >
              <Text style={styles.closeButtonText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.navBar}>
        <Pressable
          style={styles.navItem}
          onPress={() => {
            setCurrentStep("supermarkets");
            setSelectedSupermarket(null);
            setSelectedLocation(null);
            setProducts([]);
            fetchSupermarkets();
          }}
        >
          <Ionicons name="home" size={24} color="#007bff" />
          <Text style={styles.navText}>Catalogue</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => navigation.navigate("Cart", { cart, setCart })}
        >
          <View style={styles.cartContainer}>
            <Ionicons name="cart" size={24} color="#666" />
            {cartItemCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.navText}>Panier</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => navigation.navigate("Promotions")}
        >
          <Ionicons name="star" size={24} color="#666" />
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
  searchContainer: {
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
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: "#333",
    fontFamily: "Roboto-Regular",
  },
  searchButton: {
    backgroundColor: "#FF2D55",
    borderRadius: 20,
    padding: 10,
    marginLeft: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E1E1E",
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "Roboto-Bold",
  },
  categoryPicker: {
    height: 50,
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 10,
    elevation: 2,
  },
  list: {
    marginBottom: 15,
  },
  listContent: {
    paddingBottom: 10,
  },
  supermarketItem: {
    padding: 15,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  supermarketItemPressed: {
    backgroundColor: "#F0F4F8",
  },
  locationItem: {
    padding: 15,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  locationItemPressed: {
    backgroundColor: "#F0F4F8",
  },
  productRow: {
    justifyContent: "space-between",
    marginBottom: 15,
  },
  productCard: {
    width: (width - 50) / 2,
    margin: 5,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8ECEF",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    padding: 12,
    alignItems: "center",
  },
  imagePlaceholder: {
    width: "100%",
    height: 80,
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: "#888",
    fontFamily: "Roboto-Regular",
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E1E1E",
    textAlign: "center",
    marginBottom: 8,
    fontFamily: "Roboto-Medium",
  },
  productDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 14,
    color: "#4A4A4A",
    fontWeight: "500",
    fontFamily: "Roboto-Regular",
  },
  addButton: {
    backgroundColor: "#FF2D55",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Roboto-Bold",
  },
  stockOut: {
    color: "#FF4444",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 5,
    fontFamily: "Roboto-Bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  rupturePopup: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 15,
    width: "85%",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  popupTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
    color: "#1E1E1E",
    fontFamily: "Roboto-Bold",
  },
  popupSubtitle: {
    fontSize: 16,
    marginBottom: 15,
    color: "#666",
    textAlign: "center",
    fontFamily: "Roboto-Regular",
  },
  optionButton: {
    backgroundColor: "#007bff",
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
    width: "100%",
    alignItems: "center",
  },
  optionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Roboto-Medium",
  },
  closeButton: {
    backgroundColor: "#DC3545",
    paddingVertical: 12,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Roboto-Medium",
  },
  locationBanner: {
    backgroundColor: "#E0E0E0",
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: "center",
  },
  locationText: {
    fontSize: 14,
    color: "#666",
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
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF2D55",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  navText: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
    fontFamily: "Roboto-Regular",
  },
});

export default CatalogScreen;
