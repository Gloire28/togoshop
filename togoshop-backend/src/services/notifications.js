// const admin = require('firebase-admin');
const User = require('../models/User');
const Manager = require('../models/Manager');
const Driver = require('../models/Driver');

// Initialisation de Firebase (à faire une seule fois dans votre application)
// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(require('./path/to/serviceAccountKey.json')),
//     databaseURL: 'https://your-project-id.firebaseio.com'
//   });
// }

exports.sendNotification = async (userId, message) => {
  try {
    // Recherche de l'utilisateur dans différentes collections
    let user = await User.findById(userId);
    if (!user) user = await Manager.findById(userId);
    if (!user) user = await Driver.findById(userId);

    if (!user || !user.fcmToken) {
      console.log(`Utilisateur ${userId} non trouvé ou sans token FCM.`);
      return;
    }

    // Construction du message
    const payload = {
      notification: {
        title: 'Togoshop',
        body: message
      },
      token: user.fcmToken
    };

    // Envoi de la notification via FCM
    // const response = await admin.messaging().send(payload);
    // console.log('Notification envoyée avec succès:', response);
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification:', error);
    
    // Log plus détaillé pour le débogage
    // if (error.errorInfo) {
    //   console.error('Détails de l\'erreur FCM:', error.errorInfo);
      
    //   // Gestion spécifique des tokens invalides
    //   if (error.errorInfo.code === 'messaging/invalid-registration-token' || 
    //       error.errorInfo.code === 'messaging/registration-token-not-registered') {
    //     console.log(`Suppression du token invalide pour l'utilisateur ${userId}`);
    //     await User.updateOne({ _id: userId }, { $set: { fcmToken: null } });
    //   }
    // }
  }
};

// Fonction utilitaire pour formater les messages de notification.
exports.formatOrderMessage = (order, messageType, additionalData = {}) => {
  const orderIdShort = order._id.toString().substring(18);
  
  const messages = {
    SUBMITTED: `Commande #${orderIdShort} soumise. Position: ${order.queuePosition}`,
    VALIDATED: `Votre commande #${orderIdShort} est prête!`,
    CANCELLED: `Commande #${orderIdShort} annulée: ${additionalData.reason || ''}`,
    ASSIGNED: `Nouvelle commande #${orderIdShort} à valider`,
    PENDING: `Commande #${orderIdShort} en attente de validation`,
    READY_FOR_PICKUP: `Commande #${orderIdShort} prête pour ramassage`,
    IN_DELIVERY: `Livreur en route pour la commande #${orderIdShort}`,
    DELIVERED: `Commande #${orderIdShort} livrée! Points: ${additionalData.points || 0}`,
    DRIVER_ASSIGNED: `Commande #${orderIdShort} assignée à un livreur`,
    VALIDATION_CODE: `Code de validation: ${order.validationCode}`,
    STATUS_UPDATE: `Statut commande #${orderIdShort}: ${order.status.replace(/_/g, ' ')}`
  };

  return messages[messageType] || `Mise à jour commande #${orderIdShort}`;
};