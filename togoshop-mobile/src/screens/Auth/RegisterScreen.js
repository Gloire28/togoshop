import React, { useState } from "react";
import {
  View,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Text,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { register } from "../../services/api";

const RegisterScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("client");
  const navigation = useNavigation();

  const handleRegister = async () => {
    try {
      const response = await register({ email, password, role });
      console.log("Réponse d’inscription:", response.data);
      Alert.alert("Succès", "Compte créé ! Veuillez vous connecter.");
      navigation.navigate("Login");
    } catch (error) {
      console.error(
        "Erreur d’inscription:",
        error.response?.data || error.message,
      );
      Alert.alert("Erreur", "Échec de l’inscription");
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Rôle (client, manager)"
        value={role}
        onChangeText={setRole}
      />
      <Button title="S’inscrire" onPress={handleRegister} />
      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>Se connecter</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => Alert.alert("Conditions", "En cours de développement")}
      >
        <Text style={styles.link}>Conditions d'utilisation</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  link: {
    color: "#007bff",
    textAlign: "center",
    marginTop: 10,
  },
});

export default RegisterScreen;
