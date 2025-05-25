import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function LoyaltyScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Programme de Fidélité</Text>
      <Text style={styles.infoText}>Points: 150</Text>
      <Text style={styles.infoText}>Récompense: Réduction de 10% pour 100 points</Text>
      <Button title="Échanger des points" onPress={() => alert('Points échangés !')} />
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
  },
});