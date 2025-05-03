const Driver = require('../models/Driver');
const Order = require('../models/Order');

const calculateDistance = (loc1, loc2) => {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = (loc1.lat * Math.PI) / 180;
  const φ2 = (loc2.lat * Math.PI) / 180;
  const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance en mètres
};

exports.assignDriver = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Commande non trouvée');
    }

    // Trouver les livreurs disponibles
    const drivers = await Driver.find({ status: 'available' });
    console.log('Livreurs disponibles trouvés:', drivers); // Log pour débogage

    if (!drivers.length) {
      throw new Error('Aucun livreur disponible');
    }

    // Calculer la distance entre le livreur et l’adresse de livraison
    let selectedDriver = null;
    let minDistance = Infinity;

    const deliveryLocation = { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng };
    console.log('Adresse de livraison:', deliveryLocation); // Log pour débogage

    for (const driver of drivers) {
      if (!driver.currentLocation || !driver.currentLocation.lat || !driver.currentLocation.lng) {
        console.log(`Livreur ${driver._id} ignoré: position non valide`, driver.currentLocation);
        continue; // Ignorer les livreurs sans position
      }

      const driverLocation = { lat: driver.currentLocation.lat, lng: driver.currentLocation.lng };
      const distance = calculateDistance(driverLocation, deliveryLocation);
      console.log(`Distance entre livreur ${driver._id} et livraison: ${distance} mètres`);

      if (distance < minDistance) {
        minDistance = distance;
        selectedDriver = driver;
      }
    }

    if (!selectedDriver) {
      throw new Error('Aucun livreur avec une position valide trouvé');
    }

    // Assigner le livreur à la commande
    order.driverId = selectedDriver._id;
    order.status = 'in_delivery';
    await order.save();

    // Mettre à jour le statut du livreur
    selectedDriver.status = 'busy';
    await selectedDriver.save();

    return selectedDriver._id;
  } catch (error) {
    throw new Error(`Erreur lors de l’assignation du livreur : ${error.message}`);
  }
};