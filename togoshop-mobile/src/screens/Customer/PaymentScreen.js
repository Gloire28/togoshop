import React from 'react';
import { View, Text, Button } from 'react-native';
import { createOrder } from '../../services/api';

const PaymentScreen = ({ route }) => {
  const { cart, deliveryFee } = route.params;

  const handlePayment = async () => {
    const orderData = { products: cart, deliveryFee };
    await createOrder(orderData);
    // À étendre avec paiement réel
  };

  return (
    <View>
      <Text>Total: {cart.reduce((sum, item) => sum + item.price * item.quantity, 0) + deliveryFee} FCFA</Text>
      <Button title="Payer avec Portefeuille" onPress={handlePayment} />
    </View>
  );
};

export default PaymentScreen;