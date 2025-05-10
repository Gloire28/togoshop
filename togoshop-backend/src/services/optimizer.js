const Driver = require('../models/Driver');
const Order = require('../models/Order');
const Supermarket = require('../models/Supermarket');

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

const assignDriver = async (orderId, managerLocation = null) => {
  try {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new Error('Commande non trouvée');
    }

    console.log('Commande trouvée:', order);

    // Récupérer la position du supermarché via supermarketId et locationId
    const supermarket = await Supermarket.findOne({ _id: order.supermarketId }).lean();
    if (!supermarket) {
      throw new Error(`Supermarché ${order.supermarketId} non trouvé`);
    }

    const location = supermarket.locations.find(loc => loc._id === order.locationId);
    if (!location) {
      throw new Error(`Emplacement ${order.locationId} non trouvé pour le supermarché ${order.supermarketId}`);
    }

    const supermarketLocation = { lat: location.latitude, lng: location.longitude };
    const deliveryLocation = { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng };
    const managerLoc = managerLocation || { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng };

    console.log('Positions:', { supermarketLocation, deliveryLocation, managerLoc });

    // Trouver les livreurs disponibles
    const drivers = await Driver.find({ status: 'available' }).lean();
    console.log('Livreurs disponibles trouvés:', drivers);

    if (!drivers.length) {
      console.log('Aucun livreur disponible, tentative de notification ou réessai');
      throw new Error('Aucun livreur disponible');
    }

    // Calculer la distance totale (supermarché + livraison + manager)
    let selectedDriver = null;
    let minTotalDistance = Infinity;

    for (const driver of drivers) {
      if (!driver.currentLocation || !driver.currentLocation.lat || !driver.currentLocation.lng) {
        console.log(`Livreur ${driver._id} ignoré: position non valide`, driver.currentLocation);
        continue;
      }

      const driverLocation = { lat: driver.currentLocation.lat, lng: driver.currentLocation.lng };
      const distToSupermarket = calculateDistance(driverLocation, supermarketLocation);
      const distToDelivery = calculateDistance(driverLocation, deliveryLocation);
      const distToManager = calculateDistance(driverLocation, managerLoc);
      const totalDistance = distToSupermarket + distToDelivery + distToManager;

      console.log(`Driver ${driver._id}: Distance au supermarché = ${distToSupermarket.toFixed(2)}m, à la livraison = ${distToDelivery.toFixed(2)}m, au manager = ${distToManager.toFixed(2)}m, totale = ${totalDistance.toFixed(2)}m`);

      // Priorisation : Plus courte distance + gains plus bas pour équilibrer
      if (totalDistance < minTotalDistance || (totalDistance === minTotalDistance && (selectedDriver ? driver.earnings < selectedDriver.earnings : true))) {
        minTotalDistance = totalDistance;
        selectedDriver = driver;
      }
    }

    if (!selectedDriver) {
      console.log('Aucun livreur avec une position valide trouvé');
      throw new Error('Aucun livreur avec une position valide trouvé');
    }

    // Assigner le livreur
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { driverId: selectedDriver._id, status: 'in_delivery' },
      { new: true, runValidators: true }
    );
    console.log('Commande mise à jour:', updatedOrder);

    await Driver.findByIdAndUpdate(selectedDriver._id, { status: 'busy' });
    console.log(`Livreur ${selectedDriver._id} mis à jour, status: busy`);

    return selectedDriver._id;
  } catch (error) {
    console.error('Erreur dans assignDriver:', error.message);
    throw new Error(`Erreur lors de l’assignation du livreur : ${error.message}`);
  }
};

module.exports = { assignDriver };