import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { registerDriver } from '../../services/api';

const RegisterScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');

  const handleRegister = async () => {
    try {
      await registerDriver({ name, email, password, phoneNumber, vehicleDetails });
      Alert.alert('Succès', 'Livreur inscrit');
    } catch (error) {
      Alert.alert('Erreur', error.response.data.message);
    }
  };

  return (
    <View>
      <TextInput placeholder="Nom" value={name} onChangeText={setName} />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput placeholder="Numéro" value={phoneNumber} onChangeText={setPhoneNumber} />
      <TextInput placeholder="Véhicule" value={vehicleDetails} onChangeText={setVehicleDetails} />
      <Button title="Inscrire" onPress={handleRegister} />
    </View>
  );
};

export default RegisterScreen;