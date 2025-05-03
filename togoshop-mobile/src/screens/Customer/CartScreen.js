import React, { useState } from 'react';
import { View, Text, Button } from 'react-native';
import { calculateDeliveryFee } from '../../services/geolocation';
import StockIssueModal from '../../components/StockIssueModal';

const CartScreen = () => {
  const [cart, setCart] = useState([]);
  const [deliveryType, setDeliveryType] = useState('standard');
  const totalWeight = cart.reduce((sum, item) => sum + (item.weight || 1) * item.quantity, 0);
  const distance = 7; // À récupérer via geolocation
  const fee = calculateDeliveryFee(distance, totalWeight, deliveryType);

  return (
    <View>
      {cart.map((item) => (
        <View key={item._id}>
          <Text>{item.name} x{item.quantity}</Text>
          {item.stockIssue && <StockIssueModal product={item} />}
        </View>
      ))}
      <Text>Frais de livraison: {fee} FCFA</Text>
      <Button title="Course du Soir" onPress={() => setDeliveryType('evening')} />
      <Button title="Passer au paiement" />
    </View>
  );
};

export default CartScreen;