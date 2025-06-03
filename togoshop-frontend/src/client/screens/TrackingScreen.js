import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function TrackingScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suivi de la Livraison</Text>
      <View style={styles.trackingInfo}>
        <Text style={styles.infoText}>Statut : En cours de livraison</Text>
        <Text style={styles.infoText}>Livreur : Kofi</Text>
        <Text style={styles.infoText}>Temps estimé : 15 minutes</Text>
      </View>
      <Button
        title="Retour à l'Accueil"
        onPress={() => navigation.navigate('Home')}
      />
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
  trackingInfo: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
  },
  infoText: {
    fontSize: 16,
    marginVertical: 5,
  },
});