import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../../shared/services/api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password, role: 'manager' },
      });
      const { token } = response;
      console.log('Token reçu lors de la connexion:', token);

      // Stocker le token dans AsyncStorage
      await AsyncStorage.setItem('token', token);
      console.log('Token stocké dans AsyncStorage');

      Alert.alert('Succès', 'Connexion réussie !');
      navigation.navigate('Dashboard'); // Assure-toi que 'Dashboard' redirige vers 'OrderScreen'
    } catch (error) {
      Alert.alert('Erreur', 'Échec de la connexion.');
      console.log('Erreur lors de la connexion:', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connexion Manager</Text>
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
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Chargement...' : 'Se Connecter'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Créer un compte</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 5, marginBottom: 10 },
  button: { backgroundColor: '#2c3e50', padding: 15, borderRadius: 5, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16 },
  link: { color: '#2c3e50', textAlign: 'center', marginTop: 10 },
});