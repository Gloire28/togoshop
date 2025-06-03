import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function DriverRegisterScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inscription Livreur</Text>
      <Text style={styles.message}>
        Pour devenir livreur, veuillez nous contacter directement à l’adresse suivante :
      </Text>
      <Text style={styles.contact}>support@tonapp.com</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('DriverLogin')}
      >
        <Text style={styles.buttonText}>Aller à la Connexion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    color: '#34495e',
    textAlign: 'center',
    marginBottom: 10,
  },
  contact: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});