import React from 'react';

const OrderTable = ({ orders, onStatusUpdate }) => (
  <table>
    <thead>
      <tr><th>ID</th><th>Statut</th><th>Action</th></tr>
    </thead>
    <tbody>
      {orders.map((order) => (
        <tr key={order._id}>
          <td>{order._id}</td>
          <td>{order.status}</td>
          <td><button onClick={() => onStatusUpdate(order._id, 'validated')}>Valider</button></td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default OrderTable;