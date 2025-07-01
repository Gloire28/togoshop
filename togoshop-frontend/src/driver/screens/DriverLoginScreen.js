import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ImageBackground, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { loginDriver } from '../../shared/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

export default function DriverLoginScreen() {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleLogin = async () => {
    if (!name.trim() || !phoneNumber.trim()) {
      Alert.alert('Erreur', 'Nom et numéro de téléphone sont requis.');
      return;
    }
    setLoading(true);
    try {
      const credentials = { name, phoneNumber };
      const response = await loginDriver(credentials);
      await AsyncStorage.setItem('token', response.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.driver));
      navigation.replace('DriverDashboard');
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Erreur lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ImageBackground
        source={{ uri: 'https://plus.unsplash.com/premium_vector-1727131975453-7aa6281e2cef?q=80&w=703&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }} // Route ou véhicule de livraison
        style={styles.background}
        imageStyle={styles.backgroundImage}
      >
        <View style={styles.overlay}>
          <Animatable.View animation="fadeInUp" duration={1200} style={styles.content}>
            <Text style={styles.title}>Connexion Livreur</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={22} color="#a0aec0" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Nom"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                placeholderTextColor="#a0aec0"
              />
            </View>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={22} color="#a0aec0" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Numéro de téléphone"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholderTextColor="#a0aec0"
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
              {loading ? (
                <Ionicons name="reload-circle" size={24} color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Se Connecter</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('DriverRegister')}>
              <Text style={styles.link}>Pas encore inscrit ? Contactez-nous <Ionicons name="arrow-forward-outline" size={18} color="#4dabf7" /></Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    opacity: 0.4,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: 'rgba(64, 66, 50, 0.42)',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 12,
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 40,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    marginBottom: 20,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    paddingVertical: 12,
  },
  button: {
    backgroundColor: '#4dabf7', // Bleu doux pour les livreurs
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 20,
    elevation: 8,
    backgroundImage: 'linear-gradient(135deg, #4dabf7, #63b3ed)', // Dégradé bleu
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  link: {
    color: '#4dabf7',
    textAlign: 'center',
    marginTop: 25,
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});