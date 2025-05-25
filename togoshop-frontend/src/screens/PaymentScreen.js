import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PaymentScreen({ navigation }) {
  const [paymentMethod, setPaymentMethod] = useState(null);

  const handlePayment = async () => {
    if (!paymentMethod) {
      alert('Veuillez sélectionner un mode de paiement.');
      return;
    }

    // Simuler la génération d'un numéro de commande
    const orderNumber = `ORD-${Math.floor(Math.random() * 100000)}`;
    
    // Vider le panier après le paiement
    await AsyncStorage.setItem('cart', JSON.stringify([]));
    
    alert(`Paiement effectué via ${paymentMethod} ! Numéro de commande : ${orderNumber}`);
    navigation.navigate('Suivi');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choisir un mode de paiement</Text>
      <TouchableOpacity
        style={[styles.paymentOption, paymentMethod === 'Flooz' && styles.selectedOption]}
        onPress={() => setPaymentMethod('Flooz')}
      >
        <Text style={styles.optionText}>Flooz</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.paymentOption, paymentMethod === 'TMoney' && styles.selectedOption]}
        onPress={() => setPaymentMethod('TMoney')}
      >
        <Text style={styles.optionText}>TMoney</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.paymentOption, paymentMethod === 'Espèces' && styles.selectedOption]}
        onPress={() => setPaymentMethod('Espèces')}
      >
        <Text style={styles.optionText}>Espèces</Text>
      </TouchableOpacity>
      <Button
        title="Confirmer le Paiement"
        onPress={handlePayment}
      />
      <Button
        title="Retour au Panier"
        onPress={() => navigation.navigate('Panier')}
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
  paymentOption: {
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#d1e7dd',
    borderColor: '#2ecc71',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});