const mongoose = require('mongoose');
const Product = require('../models/Product');
const Supermarket = require('../models/Supermarket');
const { calculateDistance } = require('./geolocationBackend');

// Valider le stock des produits et calculer tous les frais
const validateStock = async (products, supermarketId, locationId, deliveryType, deliveryAddress) => {
  const stockIssues = [];
  const updatedProducts = [];
  let subtotal = 0; // Renommé de totalAmount pour plus de clarté
  let totalWeight = 0;
  let additionalFees = 0;

  const supermarket = await Supermarket.findById(supermarketId);
  if (!supermarket) throw new Error('Supermarché non trouvé');

  const location = supermarket.locations.find(loc => loc._id.toString() === locationId);
  if (!location) throw new Error(`Site ${locationId} invalide pour ce supermarché`);

  for (const item of products) {
    if (!item.productId || !item.quantity || item.quantity < 1) {
      throw new Error('Chaque produit doit avoir un productId et une quantité positive');
    }

    const product = await Product.findById(item.productId);
    if (!product) throw new Error(`Produit ${item.productId} non trouvé`);
    if (product.supermarketId.toString() !== supermarketId) {
      throw new Error(`Produit ${item.productId} n’appartient pas à ce supermarché`);
    }

    let stockLocationId = locationId;
    let itemAdditionalFee = 0;
    if (item.alternativeLocationId) {
      stockLocationId = item.alternativeLocationId;
      const altLocation = supermarket.locations.find(loc => loc._id.toString() === stockLocationId);
      if (!altLocation) throw new Error(`Site alternatif ${stockLocationId} invalide`);
      const distance = calculateDistance(location.latitude, location.longitude, altLocation.latitude, altLocation.longitude);
      itemAdditionalFee = 200 + 50 * distance;
      additionalFees += itemAdditionalFee;
    }

    const stock = product.stockByLocation.find(loc => loc.locationId === stockLocationId);
    if (!stock || stock.stock < item.quantity) {
      const substitutes = await Product.find({
        supermarketId,
        category: product.category,
        _id: { $ne: product._id },
        stockByLocation: { $elemMatch: { locationId, stock: { $gte: item.quantity } } },
      }).limit(3);

      const otherLocations = product.stockByLocation.filter(loc => loc.locationId !== locationId && loc.stock >= item.quantity);
      const alternativeSites = otherLocations.map(loc => {
        const altLocation = supermarket.locations.find(l => l._id.toString() === loc.locationId);
        const distance = calculateDistance(location.latitude, location.longitude, altLocation.latitude, altLocation.longitude);
        return {
          locationId: loc.locationId,
          stock: loc.stock,
          additionalFee: Math.round(200 + 50 * distance),
        };
      });

      stockIssues.push({
        productId: item.productId,
        productName: product.name,
        requestedQuantity: item.quantity,
        availableStock: stock ? stock.stock : 0,
        substitutes: substitutes.map(sub => ({ id: sub._id, name: sub.name, price: sub.price })),
        alternativeSites,
      });
    } else {
      subtotal += product.price * item.quantity;
      totalWeight += (product.weight || 1) * item.quantity;
      updatedProducts.push({
        productId: item.productId,
        quantity: item.quantity,
        alternativeLocationId: item.alternativeLocationId || '',
        comment: item.comment || '',
        photoUrl: item.photoUrl || '',
      });
    }
  }

  let deliveryFee = deliveryType === 'evening' ? 400 : 500;
  if (deliveryType !== 'evening' && deliveryAddress && deliveryAddress.lat && deliveryAddress.lng) {
    const distance = calculateDistance(location.latitude, location.longitude, deliveryAddress.lat, deliveryAddress.lng);
    const distanceFee = distance > 5 ? (distance - 5) * 100 : 0;
    const weightFee = totalWeight > 5 ? (totalWeight - 5) * 50 : 0;
    deliveryFee += distanceFee + weightFee;
  }

  // Calcul des frais de service (10% du sous-total)
  const serviceFee = Math.round(subtotal * 0.10);

  // Calcul du montant total final
  const totalAmount = subtotal + deliveryFee + additionalFees + serviceFee;

  return { 
    stockIssues, 
    updatedProducts, 
    subtotal, 
    totalWeight, 
    deliveryFee, 
    additionalFees, 
    serviceFee, 
    totalAmount 
  };
};

// Vérifier et assigner dynamiquement les commandes dans une zone de 5 km
const checkAndAssignDynamicOrders = async (orderId) => {
  const Order = require('../models/Order');
  const Driver = require('../models/Driver');
  const order = await Order.findById(orderId);
  if (!order || order.status !== 'ready_for_pickup' || order.deliveryType === 'evening') return;

  const validatedOrders = await Order.find({
    status: 'validated',
    locationId: order.locationId,
    _id: { $ne: orderId },
    deliveryType: { $ne: 'evening' },
  });

  for (const validatedOrder of validatedOrders) {
    const distance = calculateDistance(
      order.deliveryAddress.lat,
      order.deliveryAddress.lng,
      validatedOrder.deliveryAddress.lat,
      validatedOrder.deliveryAddress.lng
    );
    if (distance <= 5 && order.driverId) {
      const driver = await Driver.findById(order.driverId);
      const driverOrders = await Order.countDocuments({ driverId: order.driverId, status: 'ready_for_pickup' });
      if (driverOrders < 4) {
        validatedOrder.status = 'ready_for_pickup';
        validatedOrder.driverId = order.driverId;
        validatedOrder.zoneId = order.zoneId;
        await validatedOrder.save();
      }
    }
  }
};

module.exports = { validateStock, checkAndAssignDynamicOrders };