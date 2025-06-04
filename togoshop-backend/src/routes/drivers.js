const express = require('express');
const router = express.Router();
const driversController = require('../controllers/driversController');
const auth = require('../middleware/auth');

// Inscription d'un nouveau livreur (réservé à l'administrateur)
router.post('/register', auth, driversController.registerDriver);

// Connexion d'un livreur
router.post('/login', driversController.loginDriver);

// Récupérer les informations du livreur connecté
router.get('/me', auth, driversController.getDriver);

// Mettre à jour la position du livreur
router.put('/location', auth, driversController.updateDriverLocation);

// Activer/Désactiver la détectabilité
router.put('/discoverable', auth, driversController.toggleDiscoverable);

// Récupérer la position d’un livreur (pour le suivi client)
router.get('/:id/location', auth, driversController.getDriverLocation);

// Accepter une commande
router.post('/orders/accept', auth, driversController.acceptOrder);

// Rejeter une commande
router.post('/orders/reject', auth, driversController.rejectOrder);

// Mettre à jour le statut d'une commande (par le livreur)
router.put('/orders/status', auth, driversController.updateOrderStatus);

//signaler un probleme de livraison
router.post('/orders/report-issue', auth, driversController.reportDeliveryIssue);

module.exports = router;