import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../../shared/services/api';
import { AppContext } from '../../shared/context/AppContext';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshData } = useContext(AppContext);

  const handleLogin = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password, role: 'manager' },
      });
      const { token, user } = response; // Supposant que l'API renvoie { token, user }
      console.log('Token et user reçus:', { token, user });

      // Stocker le token et l'utilisateur dans AsyncStorage
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      console.log('Token et user stockés dans AsyncStorage');

      // Rafraîchir les données dans AppContext
      if (refreshData) await refreshData();

      Alert.alert('Succès', 'Connexion réussie !');
      navigation.navigate('Dashboard');
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