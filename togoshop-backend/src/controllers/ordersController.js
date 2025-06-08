const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Supermarket = require('../models/Supermarket');
const Driver = require('../models/Driver');
const Loyalty = require('../models/loyalty');
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
    const productData = await Product.find({ _id: { $in: productIds } });
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
    } else if (order.supermarketId.toString() !== supermarketId || order.locationId !== locationId) {
      return res.status(400).json({ error: 'Même supermarché/emplacement requis' });
    }

    products.forEach(newProduct => {
      const existingProduct = order.products.find(p => p.productId.toString() === newProduct.productId);
      if (existingProduct) {
        existingProduct.quantity += newProduct.quantity || 1;
      } else {
        order.products.push({
          productId: newProduct.productId,
          quantity: newProduct.quantity || 1,
          locationId: newProduct.locationId,
        });
      }
    });

    order.totalAmount = roundToTwoDecimals(order.products.reduce((total, item) => {
      const product = productData.find(p => p._id.toString() === item.productId.toString());
      return total + (item.quantity * (product?.price || 0));
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

    let order = await Order.findOne({
      clientId: userId,
      status: 'cart_in_progress',
    })
      .sort({ updatedAt: -1 })
      .populate({
        path: 'products.productId',
        select: 'name price stockByLocation weight',
      })
      .populate({
        path: 'supermarketId',
        select: 'name locations',
      })
      .lean();

    if (!order) {
      return res.status(200).json({ message: 'Aucune commande dans le panier', order: null });
    }

    const calculatedTotal = order.products.reduce((total, item) => {
      const productPrice = item.productId?.price || 0;
      return total + item.quantity * productPrice;
    }, 0);

    if (order.totalAmount !== calculatedTotal) {
      order.totalAmount = calculatedTotal;
      await Order.updateOne(
        { _id: order._id },
        { $set: { totalAmount: calculatedTotal, updatedAt: new Date() } }
      );
    }

    res.status(200).json(order);
  } catch (error) {
    console.error('Erreur lors de la récupération du panier:', error.message);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération du panier', error: error.message });
  }
};

// Récupérer une commande spécifique
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .select('paymentMethod deliveryAddress locationId deliveryFee clientId supermarketId subtotal serviceFee totalAmount') // Ajout des champs manquants
      .populate('products.productId')
      .populate('supermarketId');

    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (req.user.role !== 'admin' && order.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    console.log('Order renvoyé par getOrderById:', order);

    let zoneOrders = [];
    if (order.zoneId && order.status === 'ready_for_pickup' && req.user.role === 'driver') {
      zoneOrders = await Order.find({
        zoneId: order.zoneId,
        status: 'ready_for_pickup',
        deliveryType: { $ne: 'evening' },
      })
        .select('paymentMethod deliveryAddress locationId deliveryFee clientId supermarketId subtotal serviceFee totalAmount') // Ajout des champs ici aussi
        .populate('products.productId')
        .populate('supermarketId');
    }

    res.status(200).json({ order, zoneOrders });
  } catch (error) {
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
  try {
    const { id } = req.params;
    const { products, deliveryAddress } = req.body;

    let order = await Order.findById(id).populate('products.productId');
    console.log(`Statut actuel de la commande ${id}: ${order.status}`);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (order.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Non autorisé à modifier cette commande' });
    }

    if (!['cart_in_progress', 'pending_validation', 'awaiting_validator'].includes(order.status)) {
      return res.status(400).json({ message: 'La commande n’est plus modifiable' });
    }

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: 'Liste de produits requise' });
    }

    const { stockIssues, updatedProducts, subtotal, totalWeight, deliveryFee, additionalFees, serviceFee, totalAmount } = await validateStock(
      products,
      order.supermarketId.toString(),
      order.locationId,
      order.deliveryType,
      deliveryAddress || order.deliveryAddress
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
          subtotal: roundToTwoDecimals(subtotal),
          deliveryFee: roundToTwoDecimals(deliveryFee),
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

    order.products = updatedProducts;
    order.subtotal = roundToTwoDecimals(subtotal);
    order.deliveryFee = roundToTwoDecimals(deliveryFee);
    order.deliveryFee = roundToTwoDecimals(deliveryFee);
    order.serviceFee = roundToTwoDecimals(serviceFee);
    order.totalAmount = roundToTwoDecimals(totalAmount);
    order.serviceFee = roundToTwoDecimals(serviceFee);
    await order.save();

    order = await Order.findById(id).populate('products.productId');
    res.status(200).json({
      success: true,
      order: {
        ...order.toObject(),
        subtotal: roundToTwoDecimals(order.subtotal),
        deliveryFee: roundToTwoDecimals(order.deliveryFee),
        serviceFee: roundToTwoDecimals(order.serviceFee),
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

    order.status = status;
    order.updatedAt = Date.now();
    await order.save();
    console.log(`Commande sauvegardée après mise à jour:`, order);

    if (status === 'ready_for_pickup') {
      await checkAndAssignDynamicOrders(id);
    }

    await sendNotification(order.clientId, `Votre commande est maintenant ${order.status}`);
    console.log(`Notification envoyée au client ${order.clientId} pour le statut ${order.status}`);

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
    const { paymentMethod, deliveryType, clientPhone } = req.body;

    // Validation des champs requis
    if (!paymentMethod || !['Flooz', 'TMoney', 'Wallet', 'cash'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Mode de paiement invalide' });
    }
    if (!deliveryType || !['standard', 'evening', 'retrait'].includes(deliveryType)) {
      return res.status(400).json({ message: 'Type de livraison invalide' });
    }
    if (['Flooz', 'TMoney'].includes(paymentMethod) && (!clientPhone || !/^\d{8,12}$/.test(clientPhone))) {
      return res.status(400).json({ message: 'Numéro de téléphone invalide pour Flooz/TMoney' });
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
      return res.status(400).json({ message: 'Emplacement du supermarché non trouvé' });
    }

    let deliveryFee = deliveryType === 'evening' ? 400 : 500;
    if (deliveryType !== 'evening' && order.deliveryAddress && order.deliveryAddress.lat && order.deliveryAddress.lng) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        order.deliveryAddress.lat,
        order.deliveryAddress.lng
      );
      const distanceFee = distance > 5 ? (distance - 5) * 100 : 0;
      const weightFee = order.products.reduce((total, item) => total + (item.weight || 1) * item.quantity, 0) > 5 ? 50 : 0;
      deliveryFee += distanceFee + weightFee;
    }

    // Recalculer subtotal, serviceFee, et totalAmount
    const subtotal = order.subtotal || order.products.reduce((sum, item) => sum + (item.productId?.price || 0) * item.quantity, 0);
    const serviceFee = Math.round(subtotal * 0.10);
    const totalAmount = subtotal + deliveryFee + (order.additionalFees || 0) + serviceFee;

    order.subtotal = roundToTwoDecimals(subtotal);
    order.deliveryFee = roundToTwoDecimals(deliveryFee);
    order.serviceFee = roundToTwoDecimals(serviceFee);
    order.totalAmount = roundToTwoDecimals(totalAmount);
    order.deliveryType = deliveryType;
    order.paymentMethod = paymentMethod; 
    await order.save(); 

    // Créer le paiement
    const { paymentId, status: paymentStatus } = await createPayment(id, paymentMethod, clientPhone, req.user);

    // Vérifier le statut du paiement avant de soumettre
    if (paymentStatus !== 'completed') {
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
      `Votre commande (ID: ${order._id}, N°: ${orderNumber}) a été soumise. Position dans la file : ${queuePosition}. Statut : ${newStatus}`
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
      .populate('products.productId', 'name price')
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