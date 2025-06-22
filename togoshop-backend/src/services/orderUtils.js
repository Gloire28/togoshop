const mongoose = require('mongoose');
const Product = require('../models/Product');
const Supermarket = require('../models/Supermarket');
const Promotion = require('../models/Promotion');
const { calculateDistance } = require('./geolocationBackend');
const { roundToTwoDecimals } = require('./numberUtils');

/**
 * Valide le stock des produits et calcule les frais associés
 * @param {Array} products - Liste des produits à valider
 * @param {String} supermarketId - ID du supermarché
 * @param {String} locationId - ID de l'emplacement
 * @param {String} deliveryType - Type de livraison
 * @param {Object} deliveryAddress - Adresse de livraison
 * @returns {Object} Résultats de validation et calculs
 */
const validateStock = async (products, supermarketId, locationId, deliveryType, deliveryAddress) => {
  try {
    // Validation des paramètres d'entrée
    if (!products || !Array.isArray(products)) throw new Error('Liste de produits invalide');
    if (!mongoose.Types.ObjectId.isValid(supermarketId)) throw new Error('ID de supermarché invalide');
    if (!mongoose.Types.ObjectId.isValid(locationId)) throw new Error('ID de localisation invalide');

    const stockIssues = [];
    const updatedProducts = [];
    let subtotal = 0;
    let totalWeight = 0;
    let additionalFees = 0;

    // Récupération des données du supermarché
    const [supermarket, activePromotions] = await Promise.all([
      Supermarket.findById(supermarketId).lean(),
      getActivePromotions(products.map(item => item.productId))
    ]);

    if (!supermarket) throw new Error('Supermarché non trouvé');

    const location = supermarket.locations.find(loc => loc._id.toString() === locationId);
    if (!location) throw new Error(`Site ${locationId} invalide pour ce supermarché`);

    // Traitement de chaque produit
    for (const item of products) {
      validateProductItem(item);
      
      const product = await Product.findById(item.productId).lean();
      if (!product) throw new Error(`Produit ${item.productId} non trouvé`);
      if (product.supermarketId.toString() !== supermarketId) {
        throw new Error(`Produit ${item.productId} n'appartient pas à ce supermarché`);
      }

      const { stockIssue, updatedProduct, itemSubtotal, itemWeight, itemAdditionalFee } = 
        await processProductItem(item, product, location, supermarket, activePromotions);

      if (stockIssue) {
        stockIssues.push(stockIssue);
      } else {
        subtotal += itemSubtotal;
        totalWeight += itemWeight;
        additionalFees += itemAdditionalFee;
        updatedProducts.push(updatedProduct);
      }
    }

    // Calcul des frais de livraison
    const deliveryFee = calculateDeliveryFee(deliveryType, deliveryAddress, location, totalWeight);
    const serviceFee = Math.round(subtotal * 0.10);
    const totalAmount = subtotal + deliveryFee + additionalFees + serviceFee;

    return {
      stockIssues,
      updatedProducts,
      subtotal: roundToTwoDecimals(subtotal),
      totalWeight,
      deliveryFee: roundToTwoDecimals(deliveryFee),
      additionalFees: roundToTwoDecimals(additionalFees),
      serviceFee: roundToTwoDecimals(serviceFee),
      totalAmount: roundToTwoDecimals(totalAmount),
    };
  } catch (error) {
    console.error('Erreur dans validateStock:', error);
    throw error;
  }
};

/**
 * Récupère les promotions actives pour une liste de produits
 */
const getActivePromotions = async (productIds) => {
  const now = new Date();
  return Promotion.find({
    productId: { $in: productIds },
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $expr: { $lt: ['$currentUses', '$maxUses'] },
  }).lean();
};

/**
 * Valide un item produit
 */
const validateProductItem = (item) => {
  if (!item.productId || !item.quantity || item.quantity < 1) {
    throw new Error('Chaque produit doit avoir un productId et une quantité positive');
  }
};

/**
 * Traite un item produit
 */
const processProductItem = async (item, product, location, supermarket, activePromotions) => {
  let stockLocationId = location._id.toString();
  let itemAdditionalFee = 0;

  // Gestion des emplacements alternatifs
  if (item.alternativeLocationId) {
    const altLocation = supermarket.locations.find(loc => loc._id.toString() === item.alternativeLocationId);
    if (!altLocation) throw new Error(`Site alternatif ${item.alternativeLocationId} invalide`);
    
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      altLocation.latitude,
      altLocation.longitude
    );
    itemAdditionalFee = 200 + 50 * distance;
    stockLocationId = item.alternativeLocationId;
  }

  const stock = product.stockByLocation.find(loc => loc.locationId === stockLocationId);
  
  // Vérification du stock
  if (!stock || stock.stock < item.quantity) {
    return {
      stockIssue: await createStockIssue(item, product, location, supermarket)
    };
  }

  // Calcul du prix avec promotion
  const promo = activePromotions.find(p => p.productId.toString() === item.productId.toString());
  const price = promo?.promotedPrice ?? product.price;
  const itemSubtotal = price * item.quantity;
  const itemWeight = (product.weight || 1) * item.quantity;

  return {
    updatedProduct: {
      productId: item.productId,
      quantity: item.quantity,
      alternativeLocationId: item.alternativeLocationId || '',
      comment: item.comment || '',
      photoUrl: item.photoUrl || '',
      promotedPrice: promo?.promotedPrice
    },
    itemSubtotal,
    itemWeight,
    itemAdditionalFee
  };
};

/**
 * Crée un problème de stock avec alternatives
 */
const createStockIssue = async (item, product, location, supermarket) => {
  const substitutes = await Product.find({
    supermarketId: supermarket._id,
    category: product.category,
    _id: { $ne: product._id },
    stockByLocation: { $elemMatch: { locationId: location._id.toString(), stock: { $gte: item.quantity } } },
  }).limit(3).lean();

  const otherLocations = product.stockByLocation.filter(loc => 
    loc.locationId !== location._id.toString() && loc.stock >= item.quantity
  );

  const alternativeSites = otherLocations.map(loc => {
    const altLocation = supermarket.locations.find(l => l._id.toString() === loc.locationId);
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      altLocation.latitude,
      altLocation.longitude
    );
    return {
      locationId: loc.locationId,
      stock: loc.stock,
      additionalFee: roundToTwoDecimals(200 + 50 * distance),
    };
  });

  return {
    productId: item.productId,
    productName: product.name,
    requestedQuantity: item.quantity,
    availableStock: stock ? stock.stock : 0,
    substitutes: substitutes.map(sub => ({ id: sub._id, name: sub.name, price: sub.price })),
    alternativeSites,
  };
};

/**
 * Calcule les frais de livraison
 */
const calculateDeliveryFee = (deliveryType, deliveryAddress, location, totalWeight) => {
  let deliveryFee = deliveryType === 'evening' ? 400 : 500;
  
  if (deliveryType !== 'evening' && deliveryAddress?.lat && deliveryAddress?.lng) {
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      deliveryAddress.lat,
      deliveryAddress.lng
    );
    const distanceFee = distance > 5 ? (distance - 5) * 100 : 0;
    const weightFee = totalWeight > 5 ? (totalWeight - 5) * 50 : 0;
    deliveryFee += distanceFee + weightFee;
  }
  
  return deliveryFee;
};

/**
 * Assignation dynamique des commandes dans une zone de 5 km
 */
const checkAndAssignDynamicOrders = async (orderId) => {
  try {
    const Order = require('../models/Order');
    const Driver = require('../models/Driver');
    
    const order = await Order.findById(orderId);
    if (!order || order.status !== 'ready_for_pickup' || order.deliveryType === 'evening') return;

    const validatedOrders = await Order.find({
      status: 'validated',
      locationId: order.locationId,
      _id: { $ne: orderId },
      deliveryType: { $ne: 'evening' },
    }).lean();

    for (const validatedOrder of validatedOrders) {
      const distance = calculateDistance(
        order.deliveryAddress.lat,
        order.deliveryAddress.lng,
        validatedOrder.deliveryAddress.lat,
        validatedOrder.deliveryAddress.lng
      );
      
      if (distance <= 5 && order.driverId) {
        const driverOrders = await Order.countDocuments({ 
          driverId: order.driverId, 
          status: 'ready_for_pickup' 
        });
        
        if (driverOrders < 4) {
          await Order.updateOne(
            { _id: validatedOrder._id },
            { 
              $set: { 
                status: 'ready_for_pickup',
                driverId: order.driverId,
                zoneId: order.zoneId
              } 
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('Erreur dans checkAndAssignDynamicOrders:', error);
    throw error;
  }
};

module.exports = { validateStock, checkAndAssignDynamicOrders };