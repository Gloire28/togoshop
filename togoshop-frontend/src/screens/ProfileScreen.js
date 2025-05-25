import React, { useContext } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../../context/AppContext';

export default function ProfileScreen({ navigation }) {
  const { user, setUser } = useContext(AppContext);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil</Text>
      {user ? (
        <>
          <Text style={styles.infoText}>Nom: {user.name || 'Utilisateur'}</Text>
          <Text style={styles.infoText}>Email: {user.email || 'N/A'}</Text>
          <Button title="Se déconnecter" onPress={handleLogout} />
        </>
      ) : (
        <Text style={styles.infoText}>Clent togo shop</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 16,
    marginVertical: 5,
    textAlign: 'center',
  },
});