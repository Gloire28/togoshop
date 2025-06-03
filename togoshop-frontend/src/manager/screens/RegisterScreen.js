import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';

export default function RegisterScreen({ navigation }) {
  const adminPhone = '+228 96260825'; 

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inscription Manager</Text>
      <Text style={styles.message}>
        L’inscription des managers est gérée par notre équipe. Veuillez contacter notre administrateur au{' '}
        <Text style={styles.link} onPress={() => Linking.openURL(`tel:${adminPhone}`)}>
          {adminPhone}
        </Text>{' '}
        pour obtenir vos identifiants (email et mot de passe). Si vous avez déjà vos identifiants, dirigez-vous vers la page de connexion.
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.buttonText}>Aller à la Connexion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  message: { fontSize: 16, textAlign: 'center', marginBottom: 20, lineHeight: 24 },
  link: { color: '#3498db', textDecorationLine: 'underline' },
  button: { backgroundColor: '#2c3e50', padding: 15, borderRadius: 5, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16 },
});