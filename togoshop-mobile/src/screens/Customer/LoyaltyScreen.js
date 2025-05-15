import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as api from "services/api";
import { Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const LoyaltyScreen = ({ navigation }) => {
  const [loyaltyData, setLoyaltyData] = useState({
    points: 0,
    transactions: [],
  });
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    fetchLoyaltyData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
      easing: Easing.ease,
    }).start();
  }, []);

  const fetchLoyaltyData = async () => {
    try {
      setLoading(true);
      const response = await api.getUserLoyalty();
      setLoyaltyData(response.data);
    } catch (error) {
      console.error("Erreur fetchLoyaltyData:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const addPoints = async () => {
    const points = 50; // Exemple, à modifier avec un input
    const description = "Achat récent";
    try {
      await api.addPoints({ points, description });
      fetchLoyaltyData();
    } catch (error) {
      console.error("Erreur addPoints:", error.message);
    }
  };

  const redeemPoints = async () => {
    const points = 30; // Exemple, à modifier avec un input
    const description = "Récompense échangée";
    try {
      await api.redeemPoints({ points, description });
      fetchLoyaltyData();
    } catch (error) {
      console.error("Erreur redeemPoints:", error.message);
    }
  };

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
      <Text style={styles.title}>Programme de Fidélité</Text>
      <View style={styles.pointsCard}>
        <Text style={styles.pointsText}>
          Points actuels:{" "}
          <Text style={styles.pointsValue}>{loyaltyData.points}</Text>
        </Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={addPoints}>
            <Text style={styles.buttonText}>Ajouter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={redeemPoints}
            disabled={loyaltyData.points < 30}
          >
            <Text style={styles.buttonText}>Utiliser</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.subtitle}>Historique des Transactions</Text>
      <FlatList
        data={loyaltyData.transactions}
        renderItem={renderTransaction}
        keyExtractor={(item, index) => index.toString()}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Aucune transaction pour le moment
          </Text>
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
  pointsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 20,
  },
  pointsText: {
    fontSize: 22,
    color: "#34495e",
    textAlign: "center",
  },
  pointsValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#e74c3c",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 15,
  },
  button: {
    backgroundColor: "#3498db",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  list: {
    marginBottom: 20,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  transactionText: {
    marginLeft: 10,
  },
  transactionAmount: {
    fontSize: 18,
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

export default LoyaltyScreen;
