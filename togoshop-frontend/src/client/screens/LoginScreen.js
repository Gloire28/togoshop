import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login } from '../../shared/services/api';
import { AppContext } from '../../shared/context/AppContext';

export default function LoginScreen({ navigation }) {
  const { setUser } = useContext(AppContext);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(''); // Valeur par défaut correcte

  const handleLogin = async () => {
    try {
      if (!name || !phone) {
        Alert.alert('Erreur', 'Veuillez entrer votre nom et numéro de téléphone');
        return;
      }

      console.log('Tentative de login avec name:', name, 'et phone:', phone); // Débogage
      const response = await login({ name, phone });
      const { token, user } = response;
      if (!token || !user?.id || !user?.name) throw new Error('Données invalides');
      await AsyncStorage.multiSet([['token', token], ['user', JSON.stringify(user)]]);
      setUser(user);
      navigation.reset({ index: 0, routes: [{ name: 'Main', params: { initialRouteName: 'Home' } }] });
    } catch (err) {
      console.error('Erreur login:', err.message);
      Alert.alert('Erreur', err.message || 'Connexion échouée');
    }
  };

  return (
    <LinearGradient colors={['#4A90E2', '#50E3C2']} style={styles.gradient}>
      <View style={styles.container}>
        <Text style={styles.title}>TogoShop</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nom"
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Numéro de téléphone"
          keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Se connecter</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>Pas de compte ? Inscrivez-vous</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginBottom: 40 },
  input: { width: '100%', height: 50, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 25, paddingHorizontal: 20, marginBottom: 20, color: '#333' },
  button: { width: '100%', height: 50, backgroundColor: '#fff', borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  buttonText: { color: '#4A90E2', fontSize: 18, fontWeight: 'bold' },
  link: { color: '#fff', fontSize: 14, textDecorationLine: 'underline' },
});