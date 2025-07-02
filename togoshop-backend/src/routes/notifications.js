const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');
const auth = require('../middleware/auth');
// const roleCheck = require('../middleware/roleCheck');

// Abonnements utilisateur
router.post('/subscribe', auth, notificationsController.subscribeToNotification);
router.get('/', auth, notificationsController.getNotifications);
router.patch('/:id/read', auth, notificationsController.markAsRead);
router.delete('/:id', auth, notificationsController.deleteNotification);

// Création de notifications (admin)
router.post('/', 
  auth, 
  // roleCheck(['admin', 'manager']), 
  notificationsController.createNotification
);

module.exports = router;