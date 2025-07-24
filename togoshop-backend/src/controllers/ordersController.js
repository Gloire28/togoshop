const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Supermarket = require('../models/Supermarket');
const Driver = require('../models/Driver');
const Loyalty = require('../models/loyalty');
const Promotion = require('../models/Promotion');
const { assignManager } = require('../services/managerOptimizer');
const { assignDriver } = require('../services/optimizer');
const { sendNotification } = require('../services/notifications');
const { calculateDistance } = require('../services/geolocationBackend');
const loyaltyController = require('./loyaltyController');
const { validateStock, checkAndAssignDynamicOrders } = require('../services/orderUtils');
const { createPayment } = require('./paymentsController');
const { roundToTwoDecimals } = require('../services/numberUtils');

// Ajouter un produit au panier
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifié' });

    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Liste de produits invalide' });
    }

    const missingFields = products.some(product => !product.supermarketId || !product.locationId);
    if (missingFields) return res.status(400).json({ error: 'supermarketId et locationId sont requis' });

    const supermarketIds = [...new Set(products.map(p => p.supermarketId))];
    if (supermarketIds.length > 1) return res.status(400).json({ error: 'Même supermarché requis' });
    const supermarketId = supermarketIds[0];
    const supermarket = await Supermarket.findById(supermarketId);
    if (!supermarket) return res.status(404).json({ error: 'Supermarché non trouvé' });

    const locationIds = [...new Set(products.map(p => p.locationId))];
    if (locationIds.length > 1) return res.status(400).json({ error: 'Même locationId requis' });
    const locationId = locationIds[0];
    const location = supermarket.locations.find(loc => loc._id.toString() === locationId);
    if (!location) return res.status(400).json({ error: `Emplacement ${locationId} invalide` });

    const productIds = products.map(p => p.productId);
    const productData = await Product.find({ _id: { $in: productIds } }).lean();
    if (productData.length !== productIds.length) return res.status(400).json({ error: 'Produits introuvables' });

    for (const product of productData) {
      if (product.supermarketId.toString() !== supermarketId) return res.status(400).json({ error: `Produit ${product._id} hors supermarché` });
      const stockEntry = product.stockByLocation.find(loc => loc.locationId === locationId);
      const requestedQuantity = products.find(p => p.productId === product._id.toString()).quantity || 1;
      if (!stockEntry || stockEntry.stock < requestedQuantity) return res.status(400).json({ error: `Stock insuffisant pour ${product.name}` });
    }

    let order = await Order.findOne({ clientId: userId, status: 'cart_in_progress' });
    if (!order) {
      order = new Order({
        clientId: userId,
        supermarketId,
        locationId,
        products: [],
        status: 'cart_in_progress',
        totalAmount: 0,
        deliveryFee: 500,
      });
    } else if (order.products.length === 0) {
      // Si le panier est vide, autoriser la mise à jour du supermarché
      order.supermarketId = supermarketId;
      order.locationId = locationId;
    } else if (order.supermarketId.toString() !== supermarketId || order.locationId !== locationId) {
      return res.status(400).json({ error: 'Vous devez passer commande depuis le même supermarché et emplacement' });
    }

    const now = new Date();
    const activePromotions = await Promotion.find({
      productId: { $in: productIds },
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $expr: { $lt: ['$currentUses', '$maxUses'] },
    }).lean();

    products.forEach(newProduct => {
      const product = productData.find(p => p._id.toString() === newProduct.productId);
      const promo = activePromotions.find(p => p.productId.toString() === newProduct.productId);
      const existingProduct = order.products.find(p => p.productId.toString() === newProduct.productId);
      const itemPrice = promo && promo.promotedPrice !== null ? promo.promotedPrice : product.price;

      if (existingProduct) {
        existingProduct.quantity += newProduct.quantity || 1;
        existingProduct.promotedPrice = promo && promo.promotedPrice !== null ? promo.promotedPrice : null;
      } else {
        order.products.push({
          productId: newProduct.productId,
          quantity: newProduct.quantity || 1,
          locationId: newProduct.locationId,
          promotedPrice: promo && promo.promotedPrice !== null ? promo.promotedPrice : null,
        });
      }
    });

    order.totalAmount = roundToTwoDecimals(order.products.reduce((total, item) => {
      const product = productData.find(p => p._id.toString() === item.productId.toString());
      const price = item.promotedPrice || product?.price || 0;
      return total + (item.quantity * price);
    }, 0));

    await order.save();
    await order.populate('products.productId');
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Erreur addToCart:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Créer une nouvelle commande
exports.createOrder = async (req, res) => {
  try {
    const { clientId, products, supermarketId, locationId, deliveryAddress, scheduledDeliveryTime, deliveryType, comments } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0 || !supermarketId || !locationId) {
      console.log('Champs manquants dans la requête:', { products, supermarketId, locationId, deliveryAddress });
      return res.status(400).json({ message: 'Produits, supermarché et site sont requis' });
    }

    const orderClientId = req.user.role === 'admin' ? clientId : req.user.id;
    if (!orderClientId) {
      return res.status(400).json({ message: 'clientId est requis pour les administrateurs' });
    }

    console.log('User ID:', req.user.id, 'User Role:', req.user.role, 'Client ID:', orderClientId);

    const supermarket = await Supermarket.findById(supermarketId);
    if (!supermarket) {
      console.log('Supermarché non trouvé pour _id:', supermarketId);
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    const supermarketObj = supermarket.toObject();
    console.log('Supermarché récupéré (après toObject):', JSON.stringify(supermarketObj));

    if (!supermarketObj.locations || !Array.isArray(supermarketObj.locations)) {
      console.log('Aucun emplacement défini pour le supermarché:', supermarketId);
      return res.status(400).json({ message: 'Le supermarché n’a pas d’emplacements définis' });
    }

    const location = supermarketObj.locations.find(loc => {
      const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id;
      console.log(`Comparaison: locId=${locId}, locationId=${locationId}`);
      return locId === locationId;
    });
    if (!location) {
      console.log(`Site ${locationId} non trouvé dans les sites du supermarché`);
      return res.status(400).json({ message: `Site ${locationId} invalide pour ce supermarché` });
    }

    const { stockIssues, updatedProducts, totalAmount, totalWeight, deliveryFee, additionalFees } = await validateStock(
      products,
      supermarketId,
      locationId,
      deliveryType || 'standard',
      deliveryAddress
    );

    if (stockIssues.length > 0) {
      return res.status(200).json({
        message: 'Problème de stock pour certains produits',
        stockIssues,
        options: {
          A: 'Choisir un produit de substitution',
          B: 'Choisir le même produit dans un autre site (frais supplémentaires)',
          C: 'Retirer ce produit',
          D: 'Être notifié quand le produit est disponible',
        },
        partialOrder: {
          products: updatedProducts,
          totalAmount: roundToTwoDecimals(totalAmount),
          deliveryFee: roundToTwoDecimals(deliveryFee),
        },
      });
    }

    const pendingOrders = await Order.countDocuments({ supermarketId, locationId, status: { $in: ['pending_validation', 'awaiting_validator'] } });
    const queuePosition = pendingOrders + 1;
    console.log(`Position dans la file d'attente: ${queuePosition}`);

    let assignedManager = null;
    try {
      assignedManager = await assignManager(String(supermarketId), String(locationId));
      console.log('Validateur assigné:', assignedManager);
    } catch (error) {
      console.error('Erreur lors de l’assignation du validateur:', error.message);
    }

    const orderStatus = assignedManager ? 'pending_validation' : 'awaiting_validator';
    console.log('Statut de la commande avant sauvegarde:', orderStatus);

    const updatedDeliveryAddress = deliveryAddress || {
      address: '',
      lat: 6.1725,
      lng: 1.2314,
    };

    const order = new Order({
      clientId: orderClientId,
      supermarketId,
      locationId,
      products: updatedProducts,
      totalAmount: roundToTwoDecimals(totalAmount),
      deliveryFee: roundToTwoDecimals(deliveryFee),
      additionalFees: roundToTwoDecimals(additionalFees),
      deliveryAddress: updatedDeliveryAddress,
      scheduledDeliveryTime: scheduledDeliveryTime || null,
      deliveryType: deliveryType || 'standard',
      comments: comments || '',
      queuePosition,
      assignedManager,
      status: orderStatus,
    });

    await order.save();
    console.log('Commande sauvegardée avec succès, _id:', order._id);

    await sendNotification(orderClientId, `Votre commande est en attente (position ${queuePosition})`);
    console.log(`Notification envoyée au client ${orderClientId}`);

    res.status(201).json(order);
  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error.message);
    res.status(500).json({ message: 'Erreur lors de la création de la commande', error: error.message });
  }
};

// Lister les commandes en attente pour un supermarché
exports.getPendingOrders = async (req, res) => {
  try {
    const { supermarketId } = req.params;

    const orders = await Order.find({ supermarketId, status: { $in: ['pending_validation', 'awaiting_validator'] } })
      .populate('products.productId')
      .sort('createdAt');
    console.log(`Commandes en attente récupérées pour supermarketId ${supermarketId}:`, orders.length);
    res.status(200).json(orders);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération des commandes', error: error.message });
  }
};

// Récupérer le panier de l'utilisateur (commande en cours)
exports.getUserCart = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Récupération du panier pour l'utilisateur: ${userId}`);

    let order = await Order.findOne({
      clientId: userId,
      status: 'cart_in_progress',
    })
      .sort({ updatedAt: -1 })
      .populate({
        path: 'products.productId',
        select: 'name price stockByLocation weight imageUrl',
      })
      .populate({
        path: 'supermarketId',
        select: 'name locations',
      })
      .lean();

    if (!order || !order.products || order.products.length === 0) {
      console.log(`Aucune commande valide trouvée pour l'utilisateur: ${userId}`);
      return res.status(200).json({
        message: 'Aucune commande dans le panier',
        order: null,
        products: [],
        supermarketId: null,
        locationId: null,
        orderId: null,
        loyaltyPointsUsed: 0,
        loyaltyReductionAmount: 0,
      });
    }

    console.log(`Commande trouvée: ${order._id}, produits: ${order.products.length}`);

    // Vérifier les promotions actives
    const now = new Date();
    const promotions = await Promotion.find({
      productId: { $in: order.products.map(p => p.productId._id) },
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $expr: { $lt: ['$currentUses', '$maxUses'] },
    }).populate('productId');

    // Initialiser promotedPrice à null pour tous les produits
    order.products = order.products.map(product => ({
      ...product,
      promotedPrice: null, // Par défaut, pas de promotion
      imageUrl: product.productId.imageUrl || 'https://via.placeholder.com/150', // Ajout d'une URL par défaut
    }));

    // Appliquer les prix promus
    order.products.forEach(product => {
      const promo = promotions.find(p => p.productId._id.toString() === product.productId._id.toString());
      if (promo && typeof promo.promotedPrice === 'number' && promo.promotedPrice < product.productId.price) {
        product.promotedPrice = promo.promotedPrice;
        console.log(`Promotion appliquée pour le produit ${product.productId.name}: ${promo.promotedPrice} FCFA`);
      }
    });

    // Normaliser la structure des produits
    order.products = order.products.map(product => ({
      productId: product.productId._id,
      name: product.productId.name || 'Produit inconnu',
      price: Number(product.productId.price) || 0,
      quantity: Number(product.quantity) || 1,
      comment: product.comment || '',
      alternativeLocationId: product.alternativeLocationId || '',
      stockByLocation: product.productId.stockByLocation || [],
      weight: Number(product.productId.weight) || 0,
      imageUrl: product.imageUrl, // Utiliser l'imageUrl défini précédemment
      promotedPrice: product.promotedPrice !== null ? Number(product.promotedPrice) : null,
    }));

    // Recalculer le sous-total et le total
    const calculatedSubtotal = order.products.reduce((total, item) => {
      const productPrice = item.promotedPrice !== null ? item.promotedPrice : item.price;
      return total + item.quantity * productPrice;
    }, 0);

    const calculatedTotal = calculatedSubtotal + (order.deliveryFee || 0) + (order.serviceFee || 0) + (order.additionalFees || 0) - (order.loyaltyReductionAmount || 0);

    console.log(`Sous-total calculé: ${calculatedSubtotal}, Total calculé: ${calculatedTotal}`);

    // Mettre à jour la commande si nécessaire
    if (order.subtotal !== calculatedSubtotal || order.totalAmount !== calculatedTotal) {
      console.log(`Mise à jour: subtotal: ${order.subtotal} -> ${calculatedSubtotal}, total: ${order.totalAmount} -> ${calculatedTotal}`);
      
      const updateData = {
        subtotal: calculatedSubtotal,
        totalAmount: calculatedTotal,
        products: order.products,
        updatedAt: new Date(),
      };

      // Si le panier est vide après mise à jour
      if (order.products.length === 0) {
        updateData.supermarketId = null;
        updateData.locationId = null;
        updateData.deliveryFee = 0;
        updateData.serviceFee = 0;
        updateData.additionalFees = 0;
        updateData.loyaltyPointsUsed = 0;
        updateData.loyaltyReductionAmount = 0;
      }

      await Order.updateOne({ _id: order._id }, { $set: updateData });
    }

    // Ajouter orderId à la réponse
    order.orderId = order._id;

    res.status(200).json({
      ...order,
      products: order.products,
      orderId: order._id,
      supermarketId: order.supermarketId || null,
      locationId: order.locationId || null,
      loyaltyPointsUsed: order.loyaltyPointsUsed || 0,
      loyaltyReductionAmount: order.loyaltyReductionAmount || 0,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du panier:', error.message);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération du panier', error: error.message });
  }
};

// Récupérer une commande spécifique
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[NEW REQUEST] Tentative de récupération de la commande avec id: ${id} at ${new Date().toISOString()}`);

    const order = await Order.findById(id)
      .select('status paymentMethod deliveryAddress locationId deliveryFee clientId supermarketId subtotal serviceFee totalAmount queuePosition validationCode driverId estimatedTime imageUrl loyaltyPointsUsed loyaltyReductionAmount')
      .populate('driverId', 'name phoneNumber')
      .populate('products.productId')
      .populate('supermarketId');

    if (!order) {
      console.log(`Aucune commande trouvée pour l'id: ${id}`);
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (req.user.role !== 'admin' && order.clientId.toString() !== req.user.id) {
      console.log(`Accès refusé: Utilisateur ${req.user.id} tente d'accéder à la commande ${id} de ${order.clientId}`);
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    console.log(`Commande renvoyée pour id ${id}:`, {
      ...order.toJSON(),
      loyaltyPointsUsed: order.loyaltyPointsUsed || 0,
      loyaltyReductionAmount: order.loyaltyReductionAmount || 0,
    });

    let zoneOrders = [];
    if (order.zoneId && order.status === 'ready_for_pickup' && req.user.role === 'driver') {
      zoneOrders = await Order.find({
        zoneId: order.zoneId,
        status: 'ready_for_pickup',
        deliveryType: { $ne: 'evening' },
      })
        .select('paymentMethod deliveryAddress locationId deliveryFee clientId supermarketId subtotal serviceFee totalAmount imageUrl loyaltyPointsUsed loyaltyReductionAmount')
        .populate('products.productId')
        .populate('supermarketId');
    }

    let estimatedTime = 0;
    if (order.status === 'ready_for_pickup' || order.status === 'in_delivery') {
      const supermarket = await Supermarket.findById(order.supermarketId).lean();
      const location = supermarket.locations.find(loc => loc._id.toString() === order.locationId);
      if (location && order.deliveryAddress && order.deliveryAddress.lat && order.deliveryAddress.lng) {
        const distance = calculateDistance(
          { lat: location.latitude, lng: location.longitude },
          { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng }
        );
        estimatedTime = Math.round((distance / 20) * 60); // Vitesse moyenne 20 km/h en minutes
      }
    }

    res.status(200).json({
      order: {
        ...order.toJSON(),
        loyaltyPointsUsed: order.loyaltyPointsUsed || 0,
        loyaltyReductionAmount: order.loyaltyReductionAmount || 0,
      },
      zoneOrders: zoneOrders.map(zoneOrder => ({
        ...zoneOrder.toJSON(),
        loyaltyPointsUsed: zoneOrder.loyaltyPointsUsed || 0,
        loyaltyReductionAmount: zoneOrder.loyaltyReductionAmount || 0,
      })),
      queuePosition: order.queuePosition,
      estimatedTime,
    });
  } catch (error) {
    console.error(`Erreur lors de la récupération de la commande ${req.params.id}:`, error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération de la commande', error: error.message });
  }
};

// Récupérer l'historique des commandes de l'utilisateur
exports.getUserOrderHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Récupération de l'historique des commandes pour utilisateur ${userId}`);

    const orders = await Order.find({
      clientId: userId,
      status: { $in: ['delivered', 'cancelled'] },
    })
      .populate('products.productId')
      .populate('supermarketId')
      .sort('-createdAt');

    console.log(`Historique des commandes récupéré pour utilisateur ${userId}: ${orders.length} commandes`);
    res.status(200).json(orders);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'historique', error: error.message });
  }
};

// Récupérer toutes les commandes de l'utilisateur
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Récupération de toutes les commandes pour utilisateur ${userId}`);

    const orders = await Order.find({ clientId: userId })
      .select('status paymentMethod deliveryAddress locationId deliveryFee clientId supermarketId managerId totalAmount createdAt') // Projection explicite
      .populate('products.productId')
      .populate('supermarketId')
      .populate('driverId')
      .sort('-createdAt');

    if (!orders || orders.length === 0) {
      console.log(`Aucune commande trouvée pour utilisateur ${userId}`);
      return res.status(404).json({ message: 'Aucune commande trouvée' });
    }

    console.log(`Commandes récupérées pour utilisateur ${userId}: ${orders.length} commandes`);
    res.status(200).json(orders);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération des commandes', error: error.message });
  }
};

// Mettre à jour une commande
exports.updateOrder = async (req, res) => {
  const { refundPoints } = require('./loyaltyController');
  try {
    const { id } = req.params;
    const { products, deliveryAddress } = req.body;

    let order = await Order.findById(id).populate('products.productId');
    console.log(`Statut actuel de la commande ${id}: ${order.status}`);
    if (!order) {
      console.log(`Commande non trouvée pour _id ${id}`);
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (order.clientId.toString() !== req.user.id) {
      console.log(`Utilisateur ${req.user.id} non autorisé à modifier la commande ${id}`);
      return res.status(403).json({ message: 'Non autorisé à modifier cette commande' });
    }

    if (!['cart_in_progress', 'pending_validation', 'awaiting_validator'].includes(order.status)) {
      console.log(`Commande ${id} non modifiable, statut actuel: ${order.status}`);
      return res.status(400).json({ message: 'La commande n’est plus modifiable' });
    }

    if (!products || !Array.isArray(products)) {
      console.log('Liste de produits manquante ou invalide:', req.body);
      return res.status(400).json({ message: 'Liste de produits requise' });
    }

    // Log du corps reçu pour débogage
    console.log('Corps reçu dans updateOrder:', req.body);

    // Validation des locationId des produits
    const invalidLocation = products.some(p => 
      p.locationId && p.locationId !== order.locationId
    );
    if (invalidLocation && order.locationId) {
      console.log('IDs de localisation:', {
        orderLocation: order.locationId,
        productLocation: products.find(p => p.locationId).locationId
      });
      return res.status(400).json({ message: 'ID de localisation invalide pour les produits' });
    }

    // Gestion du panier vide ou modification des produits
    let stockIssues = [];
    let validationResult = {
      updatedProducts: [],
      subtotal: 0,
      deliveryFee: 0,
      additionalFees: 0,
      serviceFee: 0,
      totalAmount: 0,
      reductionAmount: order.loyaltyReductionAmount || 0 // Conserver la réduction existante par défaut
    };

    // Rembourser les points si le panier est vidé
    if (products.length === 0 && order.loyaltyPointsUsed > 0) {
      try {
        const refundResponse = await new Promise((resolve, reject) => {
          refundPoints(
            {
              user: req.user,
              body: { orderId: id },
            },
            {
              status: (code) => ({
                json: (data) => (code >= 400 ? reject(data) : resolve(data)),
              }),
            }
          );
        });
        console.log(`Points remboursés pour la commande ${id}:`, refundResponse);
      } catch (error) {
        console.error(`Erreur lors du remboursement des points pour la commande ${id}:`, error.message);
        return res.status(500).json({ message: 'Erreur lors du remboursement des points', error: error.message });
      }
    }

    // Appeler validateStock uniquement si le panier n'est pas vide
    if (products.length > 0) {
      // Récupérer les données des produits
      const productIds = products.map(p => p.productId);
      const productData = await Product.find({ _id: { $in: productIds } }).lean();
      if (productData.length !== productIds.length) {
        console.log('Certains produits non trouvés:', productIds);
        return res.status(400).json({ message: 'Certains produits n’ont pas été trouvés' });
      }

      validationResult = await validateStock(
        products,
        order.supermarketId?.toString() || null,
        order.locationId,
        order.deliveryType,
        deliveryAddress || order.deliveryAddress,
        order.loyaltyReductionAmount || 0 // Passer la réduction existante
      );
      stockIssues = validationResult.stockIssues;
    }

    if (stockIssues.length > 0) {
      console.log('Problèmes de stock détectés:', stockIssues);
      return res.status(200).json({
        message: 'Problème de stock pour certains produits',
        stockIssues,
        options: {
          A: 'Choisir un produit de substitution',
          B: 'Choisir le même produit dans un autre site (frais supplémentaires)',
          C: 'Retirer ce produit',
          D: 'Être notifié quand le produit est disponible',
        },
        partialOrder: {
          products: validationResult.updatedProducts,
          subtotal: roundToTwoDecimals(validationResult.subtotal),
          deliveryFee: roundToTwoDecimals(validationResult.deliveryFee),
          reductionAmount: roundToTwoDecimals(validationResult.reductionAmount),
        },
      });
    }

    if (deliveryAddress) {
      order.deliveryAddress = {
        address: deliveryAddress.address || order.deliveryAddress.address,
        lat: deliveryAddress.lat || order.deliveryAddress.lat,
        lng: deliveryAddress.lng || order.deliveryAddress.lng,
        instructions: deliveryAddress.instructions || order.deliveryAddress.instructions,
      };
    }

    // Appliquer les promotions uniquement si le panier n'est pas vide
    if (products.length > 0) {
      // Vérifier les promotions actives
      const now = new Date();
      const promotions = await Promotion.find({
        productId: { $in: validationResult.updatedProducts.map(p => p.productId) },
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        $expr: { $lt: ['$currentUses', '$maxUses'] },
      }).populate('productId');

      // Appliquer les prix promus
      validationResult.updatedProducts.forEach(product => {
        const promo = promotions.find(p => p.productId._id.toString() === product.productId.toString());
        if (promo && promo.promotedPrice !== null) {
          product.promotedPrice = promo.promotedPrice;
        } else {
          delete product.promotedPrice;
        }
      });
    }

    order.products = validationResult.updatedProducts;

    // Réinitialiser complètement si le panier est vide
    if (order.products.length === 0) {
      console.log(`Panier vide pour la commande ${id}, réinitialisation des champs`);
      order.supermarketId = null;
      order.locationId = null;
      order.deliveryFee = 0;
      order.serviceFee = 0;
      order.additionalFees = 0;
      order.totalAmount = 0;
      order.subtotal = 0;
      order.loyaltyPointsUsed = 0;
      order.loyaltyReductionAmount = 0;
    } else {
      // Recalculer les totaux si le panier n'est pas vide
      order.subtotal = roundToTwoDecimals(validationResult.subtotal);
      order.deliveryFee = roundToTwoDecimals(validationResult.deliveryFee);
      order.serviceFee = roundToTwoDecimals(validationResult.serviceFee);
      order.additionalFees = roundToTwoDecimals(validationResult.additionalFees);
      order.loyaltyReductionAmount = roundToTwoDecimals(validationResult.reductionAmount);
      order.totalAmount = roundToTwoDecimals(
        validationResult.subtotal +
        validationResult.deliveryFee +
        validationResult.serviceFee +
        validationResult.additionalFees -
        validationResult.reductionAmount
      );
      if (!order.locationId) {
        console.log('ID de localisation manquant pour la commande non vide:', id);
        return res.status(400).json({ message: 'ID de localisation manquant' });
      }
    }

    console.log(`Mise à jour de la commande ${id}:`, {
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      serviceFee: order.serviceFee,
      additionalFees: order.additionalFees,
      loyaltyReductionAmount: order.loyaltyReductionAmount,
      totalAmount: order.totalAmount,
    });

    await order.save();

    // Recharger l'ordre pour avoir les dernières données
    order = await Order.findById(id).populate('products.productId');

    res.status(200).json({
      success: true,
      order: {
        ...order.toObject(),
        subtotal: roundToTwoDecimals(order.subtotal),
        deliveryFee: roundToTwoDecimals(order.deliveryFee),
        serviceFee: roundToTwoDecimals(order.serviceFee),
        additionalFees: roundToTwoDecimals(order.additionalFees),
        loyaltyPointsUsed: order.loyaltyPointsUsed || 0,
        loyaltyReductionAmount: roundToTwoDecimals(order.loyaltyReductionAmount),
        totalAmount: roundToTwoDecimals(order.totalAmount),
      },
      nextStep: 'payment',
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la commande:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la commande', error: error.message });
  }
};

// Mettre à jour le statut d’une commande
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    let order = await Order.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!order) {
      console.log(`Commande non trouvée pour _id ${id}`);
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    console.log(`Commande récupérée pour _id ${id}:`, order);

    const statusTransitions = {
      awaiting_validator: ['pending_validation', 'cancelled'],
      pending_validation: ['validated', 'cancelled'],
      validated: ['ready_for_pickup', 'cancelled'],
      ready_for_pickup: ['in_delivery', 'cancelled'],
      in_delivery: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: [],
    };

    const validStatuses = ['awaiting_validator', 'pending_validation', 'validated', 'ready_for_pickup', 'in_delivery', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      console.log(`Statut invalide: ${status}`);
      return res.status(400).json({ message: 'Statut invalide' });
    }

    const allowedTransitions = statusTransitions[order.status] || [];
    if (!allowedTransitions.includes(status)) {
      console.log(`Transition de statut non autorisée: de ${order.status} à ${status}`);
      return res.status(400).json({ message: `Transition de statut non autorisée: de ${order.status} à ${status}` });
    }

    if (status === 'validated') {
      const payment = await Payment.findOne({ orderId: id });
      if (!payment || payment.status !== 'completed') {
        console.log(`Paiement non complété pour la commande ${id}`);
        return res.status(400).json({ message: 'Le paiement doit être complété avant de valider la commande' });
      }
    }

    if (status === 'pending_validation' && !order.assignedManager) {
      try {
        const managerId = await assignManager(order.supermarketId, order.locationId);
        order.assignedManager = managerId;
        console.log(`Manager assigné: ${managerId}`);
      } catch (error) {
        console.error('Erreur lors de l’assignation du manager:', error.message);
        return res.status(500).json({ message: error.message });
      }
    }

    // Supprimer le bloc qui utilisait order.remove()
    if (status === 'cancelled') {
      // Envoyer une notification d'annulation
      await sendNotification(
        order.clientId,
        `Votre commande (ID: ${order._id}) a été annulée.`
      );
      
      // Notifier le manager si assigné
      if (order.assignedManager) {
        await sendNotification(
          order.assignedManager,
          `La commande (ID: ${order._id}) a été annulée.`
        );
      }
      
      console.log(`Commande ${id} annulée.`);
    }

    if (status === 'validated' && order.status !== 'validated') {
      for (const item of order.products) {
        console.log(`Traitement du produit ${item.productId} avec quantité ${item.quantity}`);

        const product = await Product.findOne({ _id: item.productId });
        console.log(`Produit récupéré pour productId ${item.productId}:`, product);
        if (!product) {
          console.log(`Produit ${item.productId} non trouvé`);
          return res.status(404).json({ message: `Produit ${item.productId} non trouvé` });
        }

        let stockLocationId = order.locationId;
        if (item.alternativeLocationId) {
          stockLocationId = item.alternativeLocationId;
        }

        const stockEntry = product.stockByLocation.find(loc => loc.locationId === stockLocationId);
        console.log(`StockEntry pour locationId ${stockLocationId}:`, stockEntry);
        if (!stockEntry) {
          console.log(`Stock non trouvé pour le produit ${item.productId} à l'emplacement ${stockLocationId}`);
          return res.status(400).json({ message: `Stock non trouvé pour le produit ${item.productId} à l'emplacement ${stockLocationId}` });
        }

        console.log(`Vérification du stock: actuel=${stockEntry.stock}, demandé=${item.quantity}`);
        if (stockEntry.stock < item.quantity) {
          console.log(`Stock insuffisant pour le produit ${item.productId} à l'emplacement ${stockLocationId}. Stock actuel: ${stockEntry.stock}, Quantité demandée: ${item.quantity}`);
          return res.status(400).json({ message: `Stock insuffisant pour le produit ${item.productId} à l'emplacement ${stockLocationId}. Stock actuel: ${stockEntry.stock}, Quantité demandée: ${item.quantity}` });
        }

        stockEntry.stock -= item.quantity;
        console.log(`Nouveau stock après décrémentation: ${stockEntry.stock}`);
        await product.save();
        console.log(`Produit sauvegardé après mise à jour du stock:`, product);
      }
    }

    if (status === 'delivered') {
      order.status = status;

      const points = Math.floor(order.totalAmount / 2000);
      console.log(`Ajout de ${points} points de fidélité pour la commande ${id} avec montant ${order.totalAmount}`);

      try {
        await loyaltyController.addPoints(
          {
            user: { id: order.clientId.toString(), role: 'client' },
            body: {
              points: points,
              description: `Commande livrée (ID: ${order._id})`,
              fromOrder: true,
            },
          },
          {
            status: (code) => ({ json: (data) => console.log('Réponse ajout points:', data) }),
            json: (data) => console.log('Réponse ajout points:', data),
          }
        );
        console.log(`Points ajoutés avec succès pour l'utilisateur ${order.clientId}`);
      } catch (error) {
        console.error('Erreur lors de l’ajout des points:', error.message);
      }

      await sendNotification(
        order.clientId,
        `Votre commande (ID: ${order._id}) a été livrée ! Vous avez gagné ${points} points de fidélité.`
      );

      if (order.driverId) {
        const driver = await Driver.findOne({ _id: new mongoose.Types.ObjectId(order.driverId) });
        if (driver) {
          driver.status = 'available';
          driver.earnings = roundToTwoDecimals((driver.earnings || 0) + order.deliveryFee);
          await driver.save();
          console.log(`Livreur mis à jour: ${driver._id}, status: ${driver.status}, earnings: ${driver.earnings}`);
        } else {
          console.log(`Livreur non trouvé pour driverId: ${order.driverId}`);
        }
      } else {
        console.log('Aucun driverId trouvé pour cette commande, points ajoutés malgré tout');
      }
    }

    // Mettre à jour le statut et sauvegarder
    order.status = status;
    order.updatedAt = new Date();
    await order.save();
    console.log(`Commande sauvegardée après mise à jour:`, order);

    if (status === 'ready_for_pickup' && !order.driverId) {
      const { assignDriver } = require('../services/optimizer');
      try {
        const driverId = await assignDriver(order._id);
        order.driverId = driverId;
        console.log(`Livreur assigné: ${driverId}`);
      } catch (error) {
        console.error('Erreur lors de l’assignation du livreur:', error.message);
        return res.status(500).json({ message: error.message });
      }
    }

    if (status === 'ready_for_pickup') {
      await checkAndAssignDynamicOrders(id);
    }

    // Ne pas envoyer de notification pour les annulations ici
    // car elles sont déjà gérées dans le bloc status === 'cancelled'
    if (status !== 'cancelled') {
      await sendNotification(order.clientId, `Votre commande est maintenant ${order.status}`);
      console.log(`Notification envoyée au client ${order.clientId} pour le statut ${order.status}`);
    }

    res.status(200).json({ message: 'Statut mis à jour avec succès', order });
  } catch (error) {
    console.error('Erreur dans updateOrderStatus:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la commande', error: error.message });
  }
};

exports.uploadPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, comment } = req.body;

    if (!productId) {
      console.log('productId manquant dans la requête');
      return res.status(400).json({ message: 'productId est requis' });
    }

    const order = await Order.findById(id);
    if (!order) {
      console.log(`Commande non trouvée pour _id ${id}`);
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (order.clientId.toString() !== req.user.id) {
      console.log(`Utilisateur ${req.user.id} non autorisé à modifier la commande ${id}`);
      return res.status(403).json({ message: 'Non autorisé à modifier cette commande' });
    }

    if (!['pending_validation', 'awaiting_validator'].includes(order.status)) {
      console.log(`Commande ${id} n'est plus modifiable, statut: ${order.status}`);
      return res.status(400).json({ message: 'La commande n’est plus modifiable' });
    }

    const product = order.products.find(item => item.productId.toString() === productId);
    if (!product) {
      console.log(`Produit ${productId} non trouvé dans la commande ${id}`);
      return res.status(404).json({ message: 'Produit non trouvé dans la commande' });
    }

    if (comment) {
      product.comment = comment;
      console.log(`Commentaire ajouté pour le produit ${productId}: ${comment}`);
    } else {
      product.comment = null;
      console.log(`Commentaire réinitialisé à null pour le produit ${productId}`);
    }

    await order.save();
    res.status(200).json({
      message: 'Requête traitée avec succès',
      comment: product.comment || null,
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la commande:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la commande', error: error.message });
  }
};

// Soumettre une commande existante au supermarché
exports.submitOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, deliveryType, clientPhone, loyaltyPoints } = req.body;

    // Validation des champs requis
    if (!paymentMethod || !['Flooz', 'TMoney', 'Wallet', 'cash'].includes(paymentMethod)) {
      console.log(`Mode de paiement invalide: ${paymentMethod}`);
      return res.status(400).json({ message: 'Mode de paiement invalide' });
    }
    if (!deliveryType || !['standard', 'evening', 'retrait'].includes(deliveryType)) {
      console.log(`Type de livraison invalide: ${deliveryType}`);
      return res.status(400).json({ message: 'Type de livraison invalide' });
    }
    if (['Flooz', 'TMoney'].includes(paymentMethod) && (!clientPhone || !/^\d{8,12}$/.test(clientPhone))) {
      console.log(`Numéro de téléphone invalide pour ${paymentMethod}: ${clientPhone}`);
      return res.status(400).json({ message: 'Numéro de téléphone invalide pour Flooz/TMoney' });
    }
    if (loyaltyPoints !== undefined && (!Number.isInteger(loyaltyPoints) || loyaltyPoints < 0)) {
      console.log(`Points de fidélité invalides: ${loyaltyPoints}`);
      return res.status(400).json({ message: 'Nombre de points de fidélité invalide' });
    }

    const order = await Order.findById(id).populate('products.productId');
    if (!order) {
      console.log(`Commande non trouvée pour _id ${id}`);
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (order.clientId.toString() !== req.user.id) {
      console.log(`Utilisateur ${req.user.id} non autorisé à soumettre la commande ${id}`);
      return res.status(403).json({ message: 'Non autorisé à soumettre cette commande' });
    }

    if (order.status !== 'cart_in_progress') {
      console.log(`Commande ${id} n’est pas en cart_in_progress, statut actuel: ${order.status}`);
      return res.status(400).json({ message: 'La commande doit être en cart_in_progress pour être soumise' });
    }

    // Recalculer les frais de livraison en fonction du deliveryType
    const supermarket = await Supermarket.findById(order.supermarketId);
    const location = supermarket.locations.find(loc => loc._id.toString() === order.locationId);
    if (!location) {
      console.log(`Emplacement non trouvé pour locationId: ${order.locationId}`);
      return res.status(400).json({ message: 'Emplacement du supermarché non trouvé' });
    }

    let deliveryFee = deliveryType === 'evening' ? 400 : 500;
    if (deliveryType !== 'evening' && order.deliveryAddress && order.deliveryAddress.lat && order.deliveryAddress.lng) {
      const distance = calculateDistance(
        { lat: location.latitude, lng: location.longitude },
        { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng }
      );
      const distanceFee = distance > 5 ? (distance - 5) * 100 : 0;
      const weightFee = order.products.reduce((total, item) => total + (item.weight || 1) * item.quantity, 0) > 5 ? 50 : 0;
      deliveryFee += distanceFee + weightFee;
    }

    // Recalculer subtotal, serviceFee, et additionalFees
    const subtotal = order.subtotal || order.products.reduce((sum, item) => {
      const price = item.promotedPrice || item.productId?.price || 0;
      return sum + price * item.quantity;
    }, 0);
    const serviceFee = roundToTwoDecimals(subtotal * 0.10);
    const additionalFees = order.additionalFees || 0;

    // Gestion des points de fidélité
    let loyaltyPointsUsed = order.loyaltyPointsUsed || 0;
    let loyaltyReductionAmount = order.loyaltyReductionAmount || 0;
    if (loyaltyPoints !== undefined && loyaltyPoints > 0) {
      if (loyaltyPoints !== order.loyaltyPointsUsed) {
        console.log(`Incohérence des points de fidélité pour la commande ${id}: envoyés=${loyaltyPoints}, utilisés=${order.loyaltyPointsUsed}`);
        return res.status(400).json({
          message: 'Les points de fidélité envoyés ne correspondent pas à ceux déjà utilisés',
          error: `Points envoyés: ${loyaltyPoints}, Points utilisés: ${order.loyaltyPointsUsed}`,
        });
      }
      // Pas besoin d'appeler redeemPoints, car les points ont déjà été appliqués dans /loyalty/redeem
      loyaltyPointsUsed = order.loyaltyPointsUsed;
      loyaltyReductionAmount = order.loyaltyReductionAmount;
    }

    // Recalculer totalAmount
    const totalAmount = roundToTwoDecimals(subtotal + deliveryFee + serviceFee + additionalFees - loyaltyReductionAmount);
    if (totalAmount < 0) {
      console.log(`Montant total négatif après réduction pour la commande ${id}: ${totalAmount}`);
      return res.status(400).json({ message: 'La réduction des points de fidélité ne peut pas rendre le montant total négatif' });
    }

    // Mettre à jour les champs de la commande
    order.subtotal = roundToTwoDecimals(subtotal);
    order.deliveryFee = roundToTwoDecimals(deliveryFee);
    order.serviceFee = roundToTwoDecimals(serviceFee);
    order.additionalFees = roundToTwoDecimals(additionalFees);
    order.loyaltyPointsUsed = loyaltyPointsUsed;
    order.loyaltyReductionAmount = roundToTwoDecimals(loyaltyReductionAmount);
    order.totalAmount = totalAmount;
    order.deliveryType = deliveryType;
    order.paymentMethod = paymentMethod;

    console.log(`Mise à jour de la commande ${id}:`, {
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      serviceFee: order.serviceFee,
      additionalFees: order.additionalFees,
      loyaltyPointsUsed: order.loyaltyPointsUsed,
      loyaltyReductionAmount: order.loyaltyReductionAmount,
      totalAmount: order.totalAmount,
    });

    await order.save();

    // Créer le paiement
    const { paymentId, status: paymentStatus } = await createPayment(id, paymentMethod, clientPhone, req.user);

    // Vérifier le statut du paiement avant de soumettre
    if (paymentStatus !== 'completed') {
      console.log(`Paiement non complété pour la commande ${id}: ${paymentStatus}`);
      return res.status(400).json({ message: 'Le paiement n’a pas été complété. Paiement en attente de confirmation (Flooz/TMoney)' });
    }

    const pendingOrders = await Order.countDocuments({
      supermarketId: order.supermarketId,
      locationId: order.locationId,
      status: { $in: ['pending_validation', 'awaiting_validator'] },
    });
    const queuePosition = pendingOrders + 1;
    console.log(`Position dans la file d'attente: ${queuePosition}`);

    let assignedManager = null;
    try {
      assignedManager = await assignManager(String(order.supermarketId), String(order.locationId));
      console.log('Validateur assigné:', assignedManager);
    } catch (error) {
      console.log('Aucun validateur disponible, commande en attente:', error.message);
    }

    const newStatus = assignedManager ? 'pending_validation' : 'awaiting_validator';
    order.status = newStatus;
    order.queuePosition = queuePosition;
    order.assignedManager = assignedManager || null;
    await order.save();

    const orderNumber = `ORD-${Math.floor(Math.random() * 100000)}`;
    await sendNotification(
      order.clientId,
      `Votre commande (ID: ${order._id}, N°: ${orderNumber}) a été soumise. Position dans la file : ${queuePosition}. Statut : ${newStatus}${
        loyaltyPointsUsed > 0 ? `. ${loyaltyPointsUsed} points de fidélité utilisés pour une réduction de ${loyaltyReductionAmount} FCFA.` : ''
      }`
    );
    console.log(`Notification envoyée au client ${order.clientId}`);

    if (assignedManager) {
      await sendNotification(assignedManager, `Nouvelle commande (ID: ${order._id}, N°: ${orderNumber}) à valider.`);
      console.log(`Notification envoyée au manager ${assignedManager}`);
    }

    res.status(200).json({
      success: true,
      orderNumber,
      order: {
        ...order.toObject(),
        subtotal: roundToTwoDecimals(subtotal),
        deliveryFee: roundToTwoDecimals(deliveryFee),
        serviceFee: roundToTwoDecimals(serviceFee),
        additionalFees: roundToTwoDecimals(additionalFees),
        loyaltyPointsUsed,
        loyaltyReductionAmount: roundToTwoDecimals(loyaltyReductionAmount),
        totalAmount: roundToTwoDecimals(totalAmount),
      },
      paymentStatus,
    });
  } catch (error) {
    console.error('Erreur lors de la soumission de la commande:', error.message);
    res.status(500).json({ message: 'Erreur lors de la soumission de la commande', error: error.message });
  }
};

exports.getManagerOrders = async (req, res) => {
  try {
    const manager = req.user;
    if (!manager.supermarketId || !manager.locationId) {
      return res.status(400).json({ message: 'Informations de manager incomplètes' });
    }

    const supermarketId = String(manager.supermarketId);
    const locationId = String(manager.locationId);
    const managerId = String(manager.id);

    const orders = await Order.find({
      $or: [
        { assignedManager: managerId },
        {
          supermarketId: supermarketId,
          locationId: locationId,
          status: { $in: ['pending_validation', 'awaiting_validator', 'validated'] },
          assignedManager: { $in: [null, undefined] },
          deliveryType: { $ne: 'evening' },
        },
      ],
    })
      .populate('clientId', 'name comments')
      .populate('products.productId', 'name price imageUrl')
      .sort('createdAt');

    if (!orders.length) {
      return res.status(200).json({ message: 'Aucune commande à traiter', orders: [] });
    }

    res.status(200).json({ orders });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des commandes', error: error.message });
  }
};

// Valider la livraison (par le client)
exports.validateDelivery = async (req, res) => {
  try {
    const { orderId, validationCode } = req.body;
    let order = await Order.findById(orderId);
    if (!order || order.status !== 'delivered' || order.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé ou commande non prête pour validation' });
    }

    if (!validationCode || validationCode !== order.validationCode) {
      return res.status(400).json({ message: 'Code de validation incorrect' });
    }

    order.clientValidation = true;
    await order.save();

    if (order.driverId) {
      const remainingOrders = await Order.countDocuments({
        driverId: order.driverId,
        status: { $in: ['ready_for_pickup', 'in_delivery', 'delivered'] },
        clientValidation: false,
      });
      if (remainingOrders === 0) {
        const driver = await Driver.findById(order.driverId);
        if (driver) {
          driver.status = 'available';
          await driver.save();
          console.log(`Livreur ${driver._id} repassé à available après validation complète`);
        }
      }
    }

    await sendNotification(order.driverId, `Commande ${orderId} validée par le client.`);

    res.status(200).json({ message: 'Livraison validée', order });
  } catch (error) {
    console.error('Erreur lors de la validation de la livraison:', error.message);
    res.status(500).json({ message: 'Erreur lors de la validation de la livraison', error: error.message });
  }
};

// Renvoyer le code de validation (par le client)
exports.resendValidationCode = async (req, res) => {
  try {
    const { orderId } = req.body;
    let order = await Order.findById(orderId);
    if (!order || order.status !== 'delivered' || order.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé ou commande non prête pour renvoi du code' });
    }

    await sendNotification(
      order.clientId,
      `Nouveau code de validation pour votre commande (${orderId}) : ${order.validationCode}. Veuillez valider votre livraison.`
    );
    order.updatedAt = Date.now();
    await order.save();

    res.status(200).json({ message: 'Code de validation renvoyé avec succès', orderId });
  } catch (error) {
    console.error('Erreur lors du renvoi du code de validation:', error.message);
    res.status(500).json({ message: 'Erreur lors du renvoi du code de validation', error: error.message });
  }
};

// Récupérer les commandes assignées au livreur connecté
exports.getDriverOrders = async (req, res) => {
  try {
    console.log('getDriverOrders appelé pour driverId:', req.user.id);
    console.log('Paramètres de requête:', req.query);

    const driverId = req.user.id;
    // Utiliser les statuts passés en paramètre, sinon défaut à ['validated', 'ready_for_pickup', 'in_delivery']
    const statuses = req.query.statuses ? req.query.statuses.split(',') : ['validated', 'ready_for_pickup', 'in_delivery'];
    console.log('Statuts utilisés pour le filtre:', statuses);

    const orders = await Order.find({ driverId, status: { $in: statuses } })
      .select('status paymentMethod deliveryAddress locationId deliveryFee clientId supermarketId driverId updatedAt') 
      .populate('products.productId')
      .populate('supermarketId')
      .populate('clientId') 
      .sort('updatedAt');

    // Arrondir deliveryFee pour chaque commande
    const roundedOrders = orders.map(order => {
      order.deliveryFee = roundToTwoDecimals(order.deliveryFee);
      return order;
    });

    console.log('Commandes trouvées:', orders.length ? orders : 'Aucune commande trouvée');
    res.status(200).json(orders);
  } catch (error) {
    console.error('Erreur dans getDriverOrders:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération des commandes', error: error.message });
  }
};
// validation de la commande par le livreur
exports.validateDeliveryByDriver = async (req, res) => {
  console.log(`validateDeliveryByDriver appelé avec req.params:`, req.params);
  try {
    const { id } = req.params; // Changement de orderId à id
    const { validationCode } = req.body;
    const driverId = req.user.id;

    if (!id) {
      console.log('Erreur : id de commande manquant dans req.params');
      return res.status(400).json({ success: false, message: 'ID de commande manquant.' });
    }

    if (!validationCode) {
      console.log('Code de validation manquant dans la requête');
      return res.status(400).json({ success: false, message: 'Code de validation requis.' });
    }

    const order = await Order.findById(id).populate('products.productId');
    console.log(`Recherche de la commande avec _id: ${id}`);
    if (!order) {
      console.log(`Commande non trouvée pour _id: ${id}`);
      return res.status(404).json({ success: false, message: 'Commande non trouvée.' });
    }

    if (order.driverId.toString() !== driverId) {
      console.log(`Livreur ${driverId} non autorisé pour la commande ${id}`);
      return res.status(403).json({ success: false, message: 'Non autorisé à valider cette commande.' });
    }

    if (order.status !== 'in_delivery' && order.status !== 'ready_for_pickup') {
      console.log(`Commande ${id} n’est pas dans un statut valide pour validation: ${order.status}`);
      return res.status(400).json({ success: false, message: 'La commande n’est pas prête pour la validation.' });
    }

    if (order.validationCode !== validationCode.toUpperCase()) {
      console.log(`Code de validation incorrect pour la commande ${id}`);
      return res.status(400).json({ success: false, message: 'Code de validation incorrect.' });
    }

    // Mettre à jour le statut de la commande
    order.status = 'delivered';
    order.clientValidation = true;
    order.updatedAt = new Date();

    // Ajouter des points de fidélité
    const points = Math.floor(order.totalAmount / 2000);
    console.log(`Ajout de ${points} points de fidélité pour la commande ${id}`);
    try {
      await loyaltyController.addPoints(
        {
          user: { id: order.clientId.toString(), role: 'client' },
          body: {
            points: points,
            description: `Commande livrée (ID: ${order._id})`,
            fromOrder: true,
          },
        },
        {
          status: (code) => ({ json: (data) => console.log('Réponse ajout points:', data) }),
          json: (data) => console.log('Réponse ajout points:', data),
        }
      );
      console.log(`Points ajoutés pour l'utilisateur ${order.clientId}`);
    } catch (error) {
      console.error('Erreur lors de l’ajout des points:', error.message);
    }

    // Mettre à jour le livreur
    const driver = await Driver.findById(driverId);
    if (driver) {
      driver.earnings = roundToTwoDecimals((driver.earnings || 0) + order.deliveryFee);
      const remainingOrders = await Order.countDocuments({
        driverId: driverId,
        status: { $in: ['ready_for_pickup', 'in_delivery', 'delivered'] },
        clientValidation: false,
      });
      if (remainingOrders === 0) {
        driver.status = 'available';
        console.log(`Livreur ${driverId} repassé à available`);
      }
      await driver.save();
    }

    await order.save();
    console.log(`Commande ${id} validée par le livreur ${driverId}`);

    // Envoyer des notifications
    await sendNotification(order.clientId, `Votre commande (ID: ${order._id}) a été livrée ! Vous avez gagné ${points} points de fidélité.`);
    await sendNotification(driverId, `Commande ${id} validée avec succès.`);

    res.status(200).json({ success: true, message: 'Livraison validée avec succès.', order });
  } catch (error) {
    console.error('Erreur lors de la validation de la livraison par le livreur:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

// Annuler une commande (par le client)
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Annulation de la commande ${id} demandée par l'utilisateur ${req.user.id}`);

    const order = await Order.findById(id);
    if (!order) {
      console.log(`Commande non trouvée pour _id ${id}`);
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    // Vérifier que le client est bien le propriétaire de la commande
    if (order.clientId.toString() !== req.user.id) {
      console.log(`Utilisateur ${req.user.id} non autorisé à annuler la commande ${id}`);
      return res.status(403).json({ message: 'Non autorisé à annuler cette commande' });
    }

    // Vérifier que la commande est dans un statut annulable
    if (!['cart_in_progress', 'awaiting_validator', 'pending_validation'].includes(order.status)) {
      console.log(`Commande ${id} non annulable, statut actuel: ${order.status}`);
      return res.status(400).json({ 
        message: 'La commande ne peut être annulée que dans les statuts "cart_in_progress", "awaiting_validator" ou "pending_validation"' 
      });
    }

    // Rembourser les points de fidélité si utilisés
    let refundResponse = null;
    if (order.loyaltyPointsUsed > 0) {
      try {
        refundResponse = await new Promise((resolve, reject) => {
          loyaltyController.refundPoints(
            {
              user: req.user,
              body: { orderId: id },
            },
            {
              status: (code) => ({
                json: (data) => (code >= 400 ? reject(data) : resolve(data)),
              }),
            }
          );
        });
        console.log(`Points remboursés pour la commande ${id}:`, refundResponse);

        // Réinitialiser les champs de fidélité dans la commande
        order.loyaltyPointsUsed = 0;
        order.loyaltyReductionAmount = 0;
        order.totalAmount = order.subtotal + order.deliveryFee + (order.serviceFee || 0);
      } catch (error) {
        console.error(`Erreur lors du remboursement des points pour la commande ${id}:`, error.message);
        return res.status(500).json({ message: 'Erreur lors du remboursement des points', error: error.message });
      }
    }

    // Mettre à jour le statut
    order.status = 'cancelled';
    order.updatedAt = new Date();
    await order.save();

    // Envoyer une notification
    const notificationMessage = order.loyaltyPointsUsed > 0
      ? `Votre commande (${order._id}) a été annulée. ${order.loyaltyPointsUsed} points de fidélité ont été remboursés.`
      : `Votre commande (${order._id}) a été annulée.`;
    await sendNotification(order.clientId, notificationMessage);
    console.log(`Notification d'annulation envoyée au client ${order.clientId}`);

    res.status(200).json({ 
      message: 'Commande annulée avec succès', 
      order,
      loyalty: refundResponse ? refundResponse.loyalty : null
    });
  } catch (error) {
    console.error('Erreur lors de l\'annulation de la commande:', error.message);
    res.status(500).json({ message: 'Erreur lors de l\'annulation', error: error.message });
  }
};