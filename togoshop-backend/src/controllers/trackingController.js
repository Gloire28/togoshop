const Order = require('../models/Order');
const Driver = require('../models/Driver');

// Suivre une commande en temps réel
exports.trackOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate('driverId');
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    // Vérifier que l’utilisateur est le client de la commande
    if (req.user.role !== 'admin' && order.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Vérifier si un livreur est assigné
    if (!order.driverId) {
      return res.status(400).json({ message: 'Aucun livreur assigné à cette commande pour le moment' });
    }

    const driver = order.driverId;
    const trackingData = {
      orderId: order._id,
      status: order.status,
      driverName: driver.name,
      driverLocation: driver.currentLocation || { lat: null, lng: null },
      estimatedDeliveryTime: order.scheduledDeliveryTime,
    };

    res.status(200).json(trackingData);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du suivi de la commande', error: error.message });
  }
};