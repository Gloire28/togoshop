import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import jwtDecode from "jwt-decode";

// Fonctions API avec Ngrok
const getPromotions = async (token) => {
  const response = await fetch(
    "https://93f0-102-64-166-36.ngrok-free.app/api/promotions",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  return response.json();
};

const createPromotion = async (token, promotionData) => {
  const response = await fetch(
    "https://93f0-102-64-166-36.ngrok-free.app/api/promotions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(promotionData),
    },
  );
  return response.json();
};

const updatePromotion = async (token, promotionId, promotionData) => {
  const response = await fetch(
    `https://93f0-102-64-166-36.ngrok-free.app/api/promotions/${promotionId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(promotionData),
    },
  );
  return response.json();
};

const deletePromotion = async (token, promotionId) => {
  const response = await fetch(
    `https://93f0-102-64-166-36.ngrok-free.app/api/promotions/${promotionId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  return response.json();
};

const AdminPromotionsScreen = ({ navigation }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [promotions, setPromotions] = useState([]);
  const [token, setToken] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newPromotion, setNewPromotion] = useState({
    title: "",
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "",
    startDate: "",
    endDate: "",
    supermarketId: "68091a19d560ecfb2d26eeb5",
  });
  const [editPromotion, setEditPromotion] = useState(null);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("token");
        if (!storedToken) {
          Alert.alert("Erreur", "Utilisateur non connecté");
          navigation.navigate("Login");
          return;
        }

        const decoded = jwtDecode(storedToken);
        if (decoded.role !== "admin") {
          Alert.alert(
            "Accès Refusé",
            "Seuls les administrateurs peuvent accéder à cet écran",
          );
          navigation.goBack();
          return;
        }

        setToken(storedToken);
        setIsAdmin(true);

        const response = await getPromotions(storedToken);
        if (response.message && response.message.includes("Erreur")) {
          Alert.alert("Erreur", response.message);
        } else {
          setPromotions(response);
        }
      } catch (error) {
        Alert.alert("Erreur", "Erreur lors de la vérification de l'accès");
        navigation.goBack();
      }
    };

    checkAdminAccess();
  }, []);

  const handleCreatePromotion = async () => {
    if (
      !newPromotion.title ||
      !newPromotion.code ||
      !newPromotion.description ||
      !newPromotion.discountValue ||
      !newPromotion.startDate ||
      !newPromotion.endDate
    ) {
      Alert.alert("Erreur", "Tous les champs sont requis");
      return;
    }

    try {
      const response = await createPromotion(token, newPromotion);
      if (response.message && response.message.includes("Erreur")) {
        Alert.alert("Erreur", response.message);
      } else {
        setPromotions([...promotions, response.promotion]);
        setShowCreateModal(false);
        setNewPromotion({
          title: "",
          code: "",
          description: "",
          discountType: "percentage",
          discountValue: "",
          startDate: "",
          endDate: "",
          supermarketId: "68091a19d560ecfb2d26eeb5",
        });
        Alert.alert("Succès", "Promotion créée avec succès");
      }
    } catch (error) {
      Alert.alert("Erreur", "Erreur lors de la création de la promotion");
    }
  };

  const handleUpdatePromotion = async () => {
    if (!editPromotion.title || !editPromotion.discountValue) {
      Alert.alert(
        "Erreur",
        "Les champs titre et valeur de réduction sont requis",
      );
      return;
    }

    try {
      const response = await updatePromotion(
        token,
        editPromotion._id,
        editPromotion,
      );
      if (response.message && response.message.includes("Erreur")) {
        Alert.alert("Erreur", response.message);
      } else {
        setPromotions(
          promotions.map((p) =>
            p._id === editPromotion._id ? response.promotion : p,
          ),
        );
        setShowEditModal(false);
        setEditPromotion(null);
        Alert.alert("Succès", "Promotion mise à jour avec succès");
      }
    } catch (error) {
      Alert.alert("Erreur", "Erreur lors de la mise à jour de la promotion");
    }
  };

  const handleDeletePromotion = async (promotionId) => {
    try {
      const response = await deletePromotion(token, promotionId);
      if (response.message && response.message.includes("Erreur")) {
        Alert.alert("Erreur", response.message);
      } else {
        setPromotions(promotions.filter((p) => p._id !== promotionId));
        Alert.alert("Succès", "Promotion supprimée avec succès");
      }
    } catch (error) {
      Alert.alert("Erreur", "Erreur lors de la suppression de la promotion");
    }
  };

  const renderPromotion = ({ item }) => (
    <View style={styles.promotionItem}>
      <Text style={styles.itemText}>
        {item.title} - {item.code} (
        {item.discountType === "percentage"
          ? `${item.discountValue}%`
          : `${item.discountValue} FCFA`}
        )
      </Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            setEditPromotion(item);
            setShowEditModal(true);
          }}
        >
          <Text style={styles.buttonText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeletePromotion(item._id)}
        >
          <Text style={styles.buttonText}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!isAdmin) {
    return (
      <View>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Gestion des Promotions</Text>
        <Button
          title="Créer une Promotion"
          onPress={() => setShowCreateModal(true)}
        />
        <FlatList
          data={promotions}
          renderItem={renderPromotion}
          keyExtractor={(item) => item._id}
          style={styles.list}
        />
      </View>

      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Créer une Promotion</Text>
            <TextInput
              style={styles.input}
              placeholder="Titre"
              value={newPromotion.title}
              onChangeText={(text) =>
                setNewPromotion({ ...newPromotion, title: text })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Code (ex. PROMO10)"
              value={newPromotion.code}
              onChangeText={(text) =>
                setNewPromotion({ ...newPromotion, code: text })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Description"
              value={newPromotion.description}
              onChangeText={(text) =>
                setNewPromotion({ ...newPromotion, description: text })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Type de réduction (percentage/fixed)"
              value={newPromotion.discountType}
              onChangeText={(text) =>
                setNewPromotion({ ...newPromotion, discountType: text })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Valeur de réduction"
              value={newPromotion.discountValue}
              onChangeText={(text) =>
                setNewPromotion({ ...newPromotion, discountValue: text })
              }
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Date de début (YYYY-MM-DDThh:mm:ss.sssZ)"
              value={newPromotion.startDate}
              onChangeText={(text) =>
                setNewPromotion({ ...newPromotion, startDate: text })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Date de fin (YYYY-MM-DDThh:mm:ss.sssZ)"
              value={newPromotion.endDate}
              onChangeText={(text) =>
                setNewPromotion({ ...newPromotion, endDate: text })
              }
            />
            <View style={styles.modalButtons}>
              <Button title="Créer" onPress={handleCreatePromotion} />
              <Button
                title="Annuler"
                onPress={() => setShowCreateModal(false)}
                color="red"
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier une Promotion</Text>
            {editPromotion && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Titre"
                  value={editPromotion.title}
                  onChangeText={(text) =>
                    setEditPromotion({ ...editPromotion, title: text })
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Valeur de réduction"
                  value={editPromotion.discountValue.toString()}
                  onChangeText={(text) =>
                    setEditPromotion({
                      ...editPromotion,
                      discountValue: parseInt(text),
                    })
                  }
                  keyboardType="numeric"
                />
                <View style={styles.modalButtons}>
                  <Button
                    title="Mettre à jour"
                    onPress={handleUpdatePromotion}
                  />
                  <Button
                    title="Annuler"
                    onPress={() => setShowEditModal(false)}
                    color="red"
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  list: {
    marginTop: 20,
  },
  promotionItem: {
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemText: {
    fontSize: 16,
    color: "#333",
  },
  buttonContainer: {
    flexDirection: "row",
  },
  editButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "90%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
});

export default AdminPromotionsScreen;
