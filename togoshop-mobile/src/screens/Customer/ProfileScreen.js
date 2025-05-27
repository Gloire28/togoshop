import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getUserProfile,
  updateUserProfile,
  getUserOrderHistory,
  getWallet,
  depositFunds,
  getUserNotifications,
} from "../../services/api";

const ProfileScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("Flooz");
  const [depositPhone, setDepositPhone] = useState("");
  // Ajout des états pour gérer le panier et la réduction
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const profileResponse = await getUserProfile();
        const userData = profileResponse.data;
        setUser(userData);
        setName(userData.name);
        setEmail(userData.email);
        setPhone(userData.phone || "");

        const ordersResponse = await getUserOrderHistory();
        setOrders(ordersResponse.data);

        const walletResponse = await getWallet();
        setWallet(walletResponse.data);

        const notificationsResponse = await getUserNotifications();
        setNotifications(notificationsResponse.data);

        // Charger le panier depuis AsyncStorage
        const storedCart = await AsyncStorage.getItem("cart");
        if (storedCart) {
          setCart(JSON.parse(storedCart));
        }
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des données du profil:",
          error,
        );
        Alert.alert("Erreur", "Impossible de charger les données du profil");
      }
    };
    fetchProfileData();
  }, []);

  const handleUpdateProfile = async () => {
    try {
      const updatedData = { name, email, phone };
      if (password) updatedData.password = password;
      const response = await updateUserProfile(updatedData);
      setUser(response.data.user);
      setEditMode(false);
      setPassword("");
      Alert.alert("Succès", "Profil mis à jour avec succès");
    } catch (error) {
      console.error("Erreur lors de la mise à jour du profil:", error);
      Alert.alert(
        "Erreur",
        error.response?.data?.message ||
          "Erreur lors de la mise à jour du profil",
      );
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || depositAmount <= 0) {
      Alert.alert("Erreur", "Veuillez entrer un montant valide");
      return;
    }
    if (!depositPhone) {
      Alert.alert("Erreur", "Veuillez entrer un numéro de téléphone");
      return;
    }

    try {
      const depositData = {
        amount: parseFloat(depositAmount),
        method: depositMethod,
        clientPhone: depositPhone,
      };
      const response = await depositFunds(depositData);
      setWallet(response.data.wallet);
      setDepositModalVisible(false);
      setDepositAmount("");
      setDepositPhone("");
      Alert.alert("Succès", "Fonds ajoutés avec succès");
    } catch (error) {
      console.error("Erreur lors du dépôt:", error);
      Alert.alert(
        "Erreur",
        error.response?.data?.message || "Erreur lors du dépôt",
      );
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    navigation.replace("Login");
  };

  const renderProfileSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Informations Personnelles</Text>
      {editMode ? (
        <View>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nom"
          />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Téléphone"
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Nouveau mot de passe (optionnel)"
            secureTextEntry
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleUpdateProfile}
            >
              <Text style={styles.buttonText}>Enregistrer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setEditMode(false)}
            >
              <Text style={styles.buttonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.infoText}>Nom: {user?.name}</Text>
          <Text style={styles.infoText}>Email: {user?.email}</Text>
          <Text style={styles.infoText}>
            Téléphone: {user?.phone || "Non défini"}
          </Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setEditMode(true)}
          >
            <Text style={styles.buttonText}>Modifier le Profil</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderWalletSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Portefeuille</Text>
      <Text style={styles.infoText}>Solde: {wallet?.balance || 0} FCFA</Text>
      <TouchableOpacity
        style={styles.depositButton}
        onPress={() => setDepositModalVisible(true)}
      >
        <Text style={styles.buttonText}>Ajouter des Fonds</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOrderHistory = ({ item }) => (
    <View style={styles.orderItem}>
      <Text style={styles.orderText}>Commande #{item._id}</Text>
      <Text style={styles.orderText}>Statut: {item.status}</Text>
      <Text style={styles.orderText}>
        Total:{" "}
        {item.totalAmount + item.deliveryFee + (item.additionalFees || 0)} FCFA
      </Text>
      <Text style={styles.orderText}>
        Date: {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );

  const renderNotification = ({ item }) => (
    <View style={styles.notificationItem}>
      <Text style={styles.notificationText}>{item.message}</Text>
      <Text style={styles.notificationDate}>
        {new Date(item.createdAt).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Profil</Text>

        {renderProfileSection()}
        {renderWalletSection()}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique des Commandes</Text>
          {orders.length > 0 ? (
            <FlatList
              data={orders}
              renderItem={renderOrderHistory}
              keyExtractor={(item) => item._id}
              style={styles.list}
            />
          ) : (
            <Text style={styles.emptyText}>Aucune commande passée</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          {notifications.length > 0 ? (
            <FlatList
              data={notifications}
              renderItem={renderNotification}
              keyExtractor={(item) => item._id}
              style={styles.list}
            />
          ) : (
            <Text style={styles.emptyText}>Aucune notification</Text>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.buttonText}>Déconnexion</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={depositModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ajouter des Fonds</Text>
            <TextInput
              style={styles.input}
              value={depositAmount}
              onChangeText={setDepositAmount}
              placeholder="Montant (FCFA)"
              keyboardType="numeric"
            />
            <View style={styles.paymentMethods}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  depositMethod === "Flooz" && styles.methodButtonSelected,
                ]}
                onPress={() => setDepositMethod("Flooz")}
              >
                <Text style={styles.methodText}>Flooz</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  depositMethod === "TMoney" && styles.methodButtonSelected,
                ]}
                onPress={() => setDepositMethod("TMoney")}
              >
                <Text style={styles.methodText}>TMoney</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={depositPhone}
              onChangeText={setDepositPhone}
              placeholder="Numéro de téléphone"
              keyboardType="phone-pad"
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleDeposit}
              >
                <Text style={styles.buttonText}>Déposer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setDepositModalVisible(false)}
              >
                <Text style={styles.buttonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
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
              setCart,
              discount,
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
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person" size={24} color="#007bff" />
          <Text style={styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  infoText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
  },
  input: {
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    flex: 1,
    marginRight: 5,
  },
  cancelButton: {
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    flex: 1,
    marginLeft: 5,
  },
  depositButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  logoutButton: {
    backgroundColor: "#dc3545",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  orderItem: {
    backgroundColor: "#f9f9f9",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  orderText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 5,
  },
  notificationItem: {
    backgroundColor: "#f9f9f9",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  notificationText: {
    fontSize: 14,
    color: "#333",
  },
  notificationDate: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  list: {
    maxHeight: 200,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  paymentMethods: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  methodButton: {
    flex: 1,
    padding: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    alignItems: "center",
    marginHorizontal: 5,
  },
  methodButtonSelected: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  methodText: {
    fontSize: 14,
    color: "#333",
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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

export default ProfileScreen;

// Rappel : Si tu as d'autres modifications à apporter à ProfileScreen.js (par exemple, pour gérer le passage à CartScreen avec des données supplémentaires), n'oublie pas de me le préciser dans une prochaine demande.
