import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as api from "services/api";
import { Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const AdminLoyaltyScreen = ({ navigation }) => {
  const [loyaltyData, setLoyaltyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [userId, setUserId] = useState("");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchAllLoyaltyData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
      easing: Easing.ease,
    }).start();
  }, []);

  const fetchAllLoyaltyData = async () => {
    try {
      setLoading(true);
      // Simule une liste de tous les profils de fidélité (à adapter selon une API admin)
      const response = await api.getUserLoyalty(); // Pour un seul user, à étendre pour tous
      setLoyaltyData([response.data]); // À remplacer par une API listant tous les users si disponible
    } catch (error) {
      console.error("Erreur fetchAllLoyaltyData:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const addPoints = async () => {
    if (!userId || !points || !description || points <= 0) {
      alert(
        "Veuillez entrer un userId, des points positifs et une description",
      );
      return;
    }
    try {
      await api.addPoints({ points: parseInt(points), description, userId });
      fetchAllLoyaltyData();
      setPoints("");
      setDescription("");
    } catch (error) {
      console.error("Erreur addPoints:", error.message);
    }
  };

  const redeemPoints = async () => {
    if (!userId || !points || !description || points <= 0) {
      alert(
        "Veuillez entrer un userId, des points positifs et une description",
      );
      return;
    }
    try {
      await api.redeemPoints({ points: parseInt(points), description, userId });
      fetchAllLoyaltyData();
      setPoints("");
      setDescription("");
    } catch (error) {
      console.error("Erreur redeemPoints:", error.message);
    }
  };

  const renderLoyaltyItem = ({ item }) => (
    <View style={styles.loyaltyItem}>
      <Text style={styles.userId}>User ID: {item.userId}</Text>
      <Text style={styles.points}>
        Points: <Text style={styles.pointsValue}>{item.points}</Text>
      </Text>
      <FlatList
        data={item.transactions}
        renderItem={renderTransaction}
        keyExtractor={(transaction, index) => index.toString()}
        style={styles.transactionList}
      />
    </View>
  );

  const renderTransaction = ({ item }) => (
    <View style={styles.transactionItem}>
      <Ionicons
        name={item.type === "earned" ? "arrow-up-circle" : "arrow-down-circle"}
        size={20}
        color={item.type === "earned" ? "#2ecc71" : "#e74c3c"}
      />
      <View style={styles.transactionText}>
        <Text style={styles.transactionAmount}>
          {item.type === "earned" ? "+" : "-"}
          {item.amount} pts
        </Text>
        <Text style={styles.transactionDescription}>{item.description}</Text>
        <Text style={styles.transactionDate}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.title}>Gestion des Points de Fidélité (Admin)</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={setUserId}
          placeholder="User ID"
          keyboardType="default"
        />
        <TextInput
          style={styles.input}
          value={points}
          onChangeText={setPoints}
          placeholder="Points"
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={addPoints}>
            <Text style={styles.buttonText}>Ajouter Points</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={redeemPoints}>
            <Text style={styles.buttonText}>Utiliser Points</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.subtitle}>Liste des Profils</Text>
      <FlatList
        data={loyaltyData}
        renderItem={renderLoyaltyItem}
        keyExtractor={(item, index) => index.toString()}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Aucun profil trouvé</Text>
        }
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f7fa",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#34495e",
    marginTop: 20,
    marginBottom: 10,
  },
  inputContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    backgroundColor: "#3498db",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 5,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  list: {
    marginBottom: 20,
  },
  loyaltyItem: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  userId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#34495e",
  },
  points: {
    fontSize: 18,
    color: "#34495e",
    marginTop: 5,
  },
  pointsValue: {
    fontWeight: "bold",
    color: "#e74c3c",
  },
  transactionList: {
    marginTop: 10,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ecf0f1",
  },
  transactionText: {
    marginLeft: 10,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2ecc71",
  },
  transactionDescription: {
    fontSize: 14,
    color: "#7f8c8d",
  },
  transactionDate: {
    fontSize: 12,
    color: "#bdc3c7",
  },
  emptyText: {
    textAlign: "center",
    color: "#7f8c8d",
    fontSize: 16,
  },
});

export default AdminLoyaltyScreen;
