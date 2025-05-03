import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { login } from '../../services/api';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigation = useNavigation();

  const handleLogin = async () => {
    try {
      const response = await login({ email, password });
      // Stocker le token (à adapter avec AsyncStorage)
      console.log(response.data.token);
      navigation.navigate('Catalog');
    } catch (error) {
      Alert.alert('Erreur', 'Email ou mot de passe incorrect');
    }
  };

  return (
    <View>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Connexion" onPress={handleLogin} />
    </View>
  );
};

export default LoginScreen;