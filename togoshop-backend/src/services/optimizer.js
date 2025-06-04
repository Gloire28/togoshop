const Driver = require('../models/Driver');
const Order = require('../models/Order');
const Supermarket = require('../models/Supermarket');

const calculateDistance = (point1, point2) => {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceInMeters = R * c;
  return distanceInMeters / 1000; // Convertir en kilomètres
};

// Assigner un livreur à une commande (initialement en validated)
const assignDriver = async (orderId, managerLocation = null) => {
  try {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new Error('Commande non trouvée');
    }

    if (order.status !== 'validated') {
      throw new Error('La commande doit être en statut "validated" pour assigner un livreur');
    }

    if (order.deliveryType === 'evening') {
      throw new Error('Les commandes de type "evening" ne sont pas gérées par cette logique');
    }

    const supermarket = await Supermarket.findOne({ _id: order.supermarketId }).lean();
    if (!supermarket) {
      throw new Error(`Supermarché ${order.supermarketId} non trouvé`);
    }

    const location = supermarket.locations.find(loc => loc._id.toString() === order.locationId);
    if (!location) {
      throw new Error(`Emplacement ${order.locationId} non trouvé pour le supermarché ${order.supermarketId}`);
    }

    const supermarketLocation = { lat: location.latitude, lng: location.longitude };
    const deliveryLocation = { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng };
    const managerLoc = managerLocation || { lat: location.latitude, lng: location.longitude };

    // Vérifier d'abord si un livreur en pending_pickup a une zone compatible (rayon de 5 km)
    const existingDriver = await findDriverForZone(order);
    if (existingDriver) {
      await Order.findByIdAndUpdate(orderId, { driverId: existingDriver._id, zoneId: existingDriver.zoneId });
      return existingDriver._id;
    }

    // Si aucun livreur avec une zone compatible, chercher un nouveau livreur
    const drivers = await Driver.find({ status: 'available', isDiscoverable: true }).lean();
    if (!drivers.length) {
      throw new Error('Aucun livreur disponible et détectable');
    }

    let selectedDriver = null;
    let minTotalDistance = Infinity;

    for (const driver of drivers) {
      if (!driver.currentLocation || !driver.currentLocation.lat || !driver.currentLocation.lng) {
        continue;
      }

      const driverLocation = { lat: driver.currentLocation.lat, lng: driver.currentLocation.lng };
      const distToSupermarket = calculateDistance(driverLocation, supermarketLocation);
      const distToDelivery = calculateDistance(driverLocation, deliveryLocation);
      const distToManager = calculateDistance(driverLocation, managerLoc);
      const totalDistance = distToSupermarket + distToDelivery + distToManager;

      if (totalDistance < minTotalDistance || (totalDistance === minTotalDistance && (selectedDriver ? driver.earnings < selectedDriver.earnings : true))) {
        minTotalDistance = totalDistance;
        selectedDriver = driver;
      }
    }

    if (!selectedDriver) {
      throw new Error('Aucun livreur avec une position valide trouvé');
    }

    // Assigner le livreur mais laisser en validated (acceptation manuelle)
    await Order.findByIdAndUpdate(orderId, { driverId: selectedDriver._id });
    return selectedDriver._id;
  } catch (error) {
    throw new Error(`Erreur lors de l’assignation du livreur : ${error.message}`);
  }
};

// Vérifier si un livreur a une zone compatible (rayon de 5 km) et gérer le groupage
const findDriverForZone = async (newOrder) => {
  const activeOrders = await Order.find({
    status: 'ready_for_pickup',
    locationId: newOrder.locationId,
    deliveryType: { $ne: 'evening' },
  }).lean();

  for (const activeOrder of activeOrders) {
    const distance = calculateDistance(
      { lat: activeOrder.deliveryAddress.lat, lng: activeOrder.deliveryAddress.lng },
      { lat: newOrder.deliveryAddress.lat, lng: newOrder.deliveryAddress.lng }
    );

    if (distance <= 5 && activeOrder.driverId) {
      const driver = await Driver.findById(activeOrder.driverId).lean();
      if (!driver || driver.status !== 'pending_pickup') continue;

      const driverOrders = await Order.countDocuments({
        driverId: activeOrder.driverId,
        status: 'ready_for_pickup',
      });

      if (driverOrders < 4) {
        return { _id: driver._id, zoneId: activeOrder.zoneId };
      }
    }
  }

  return null;
};

// Regrouper les commandes pour un livreur en pending_pickup
const groupOrders = async (driverId, initialOrderId) => {
  const initialOrder = await Order.findById(initialOrderId);
  const ordersToGroup = await Order.find({
    status: 'validated',
    supermarketId: initialOrder.supermarketId,
    locationId: initialOrder.locationId,
    _id: { $ne: initialOrderId },
  });

  let groupedCount = 1; // Compte l’ordre initial
  for (const order of ordersToGroup) {
    const distance = calculateDistance(
      { lat: initialOrder.deliveryAddress.lat, lng: initialOrder.deliveryAddress.lng },
      { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng }
    );
    if (distance <= 5 && groupedCount < 4) {
      order.driverId = driverId;
      order.zoneId = initialOrder.zoneId;
      order.status = 'ready_for_pickup';
      order.acceptedAt = new Date(); // Marquer l’acceptation
      await order.save();
      groupedCount++;
    }
  }
  return groupedCount;
};

// Assigner automatiquement un livreur à toutes les commandes en validated
const autoAssignDrivers = async () => {
  const validatedOrders = await Order.find({
    status: 'validated',
    driverId: null,
    deliveryType: { $ne: 'evening' },
  }).sort({ priority: 1, createdAt: 1 }); // Priorité aux commandes refusées

  for (const order of validatedOrders) {
    try {
      await assignDriver(order._id);
    } catch (error) {
      console.error(`Erreur lors de l'assignation pour la commande ${order._id}:`, error.message);
    }
  }
};

module.exports = { calculateDistance, assignDriver, autoAssignDrivers, groupOrders };