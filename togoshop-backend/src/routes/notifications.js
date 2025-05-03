const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');
const auth = require('../middleware/auth');

router.post('/subscribe', auth, notificationsController.subscribeToRestock);

router.get('/me', auth, notificationsController.getNotifications);

module.exports = router;