import React, { useState, useEffect } from 'react';
import { getPendingOrders, updateOrderStatus } from '../services/api';
import OrderTable from '../components/OrderTable';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const supermarketId = '68147b8aefd77f597e361570'; // À rendre dynamique

  useEffect(() => {
    const fetchOrders = async () => {
      const response = await getPendingOrders(supermarketId);
      setOrders(response.data);
    };
    fetchOrders();
  }, [supermarketId]);

  const handleStatusUpdate = async (orderId, status) => {
    await updateOrderStatus(orderId, status);
    // Rafraîchir la liste
  };

  return <OrderTable orders={orders} onStatusUpdate={handleStatusUpdate} />;
};

export default OrdersPage;