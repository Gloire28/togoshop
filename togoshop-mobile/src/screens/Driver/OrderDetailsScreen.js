import React from 'react';
import { View, Text, Button } from 'react-native';
import { updateOrderStatus } from '../../services/api';

const OrderDetailsScreen = ({ route }) => {
  const { order } = route.params;

  const handleUpdateStatus = async () => {
    await updateOrderStatus(order._id, 'delivered');
  };

  return (
    <View>
      <Text>Commande {order._id}</Text>
      <Button title="Marquer comme livrée" onPress={handleUpdateStatus} />
    </View>
  );
};

export default OrderDetailsScreen;