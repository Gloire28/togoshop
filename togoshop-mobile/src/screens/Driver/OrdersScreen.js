import React, { useEffect, useState } from 'react';
import { View, FlatList } from 'react-native';
import { getPendingOrders } from '../../services/api';

const OrdersScreen = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchOrders = async () => {
      const response = await getPendingOrders('driver'); // À adapter avec driverId
      setOrders(response.data);
    };
    fetchOrders();
  }, []);

  return (
    <View>
      <FlatList
        data={orders}
        renderItem={({ item }) => <Text>{item._id}</Text>}
        keyExtractor={(item) => item._id}
      />
    </View>
  );
};

export default OrdersScreen;