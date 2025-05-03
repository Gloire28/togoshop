import { Alert } from 'react-native';

export const showNotification = (message) => {
  Alert.alert('Notification', message);
  // À étendre avec push notifications (ex. : Firebase)
};

export const handleOrderStatus = (status) => {
  const messages = {
    awaiting_validator: 'Votre commande est en attente (position X).',
    validated: 'Votre commande a été validée.',
    in_delivery: 'Votre commande est en cours de livraison.',
    delivered: 'Votre commande a été livrée.',
  };
  return messages[status] || 'Mise à jour de statut.';
};