const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Supermarket = require('../models/Supermarket');
const Driver = require('../models/Driver');
const { assignManager } = require('../services/managerOptimizer');
const { assignDriver } = require('../services/optimizer');
const { sendNotification } = require('../services/notifications');
const { calculateDistance } = require('../services/geolocationBackend');

// Créer une nouvelle commande
exports.createOrder = async (req, res) => {
  try {
    const { products, supermarketId, locationId, deliveryAddress, scheduledDeliveryTime, deliveryType, comments } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0 || !supermarketId || !locationId || !deliveryAddress || !deliveryAddress.address) {
      console.log('Champs manquants dans la requête:', { products, supermarketId, locationId, deliveryAddress });
      return res.status(400).json({ message: 'Produits, supermarché, site et adresse de livraison sont requis' });
    }

    console.log('Recherche du supermarché avec _id:', supermarketId);
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
    console.log('Vérification de locations:', supermarketObj.locations);

    const location = supermarketObj.locations.find(loc => {
      const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id;
      console.log(`Comparaison: locId=${locId}, locationId=${locationId}`);
      return locId === locationId;
    });
    if (!location) {
      console.log(`Site ${locationId} non trouvé dans les sites du supermarché`);
      return res.status(400).json({ message: `Site ${locationId} invalide pour ce supermarché` });
    }

    let totalAmount = 0;
    let totalWeight = 0;
    let additionalFees = 0;
    const stockIssues = [];
    const updatedProducts = [];

    for (const item of products) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        console.log('Produit invalide:', item);
        return res.status(400).json({ message: 'Chaque produit doit avoir un productId et une quantité positive' });
      }

      console.log('Recherche du produit avec _id:', item.productId);
      const product = await Product.findById(item.productId);
      if (!product) {
        console.log('Produit non trouvé pour _id:', item.productId);
        return res.status(404).json({ message: `Produit ${item.productId} non trouvé` });
      }
      console.log('Produit trouvé:', JSON.stringify(product));

      if (product.supermarketId.toString() !== supermarketId) {
        console.log(`Produit ${item.productId} n’appartient pas au supermarché ${supermarketId}`);
        return res.status(400).json({ message: `Produit ${item.productId} n’appartient pas à ce supermarché` });
      }

      let stockLocationId = locationId;
      let itemAdditionalFee = 0;
      if (item.alternativeLocationId) {
        stockLocationId = item.alternativeLocationId;
        const altLocation = supermarketObj.locations.find(loc => {
          const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id;
          return locId === stockLocationId;
        });
        if (!altLocation) {
          console.log(`Site alternatif ${stockLocationId} invalide`);
          return res.status(400).json({ message: `Site alternatif ${stockLocationId} invalide` });
        }
        const distance = calculateDistance(location.latitude, location.longitude, altLocation.latitude, altLocation.longitude);
        itemAdditionalFee = 200 + 50 * distance;
        additionalFees += itemAdditionalFee;
        console.log(`Frais supplémentaires pour ${item.productId} à ${stockLocationId}: ${itemAdditionalFee} FCFA`);
      }

      const stock = product.stockByLocation.find(loc => loc.locationId === stockLocationId);
      if (!stock || stock.stock < item.quantity) {
        console.log(`Rupture de stock pour productId: ${item.productId}, locationId: ${stockLocationId}`);
        console.log(`Recherche de substituts pour productId: ${item.productId}, category: ${product.category}, locationId: ${locationId}, quantity: ${item.quantity}`);
        const substitutes = await Product.find({
          supermarketId,
          category: product.category,
          _id: { $ne: product._id },
          stockByLocation: {
            $elemMatch: { locationId: locationId, stock: { $gte: item.quantity } }
          }
        }).limit(3);
        console.log(`Substituts trouvés: ${JSON.stringify(substitutes)}`);

        console.log(`Recherche de sites alternatifs pour productId: ${item.productId}, stockByLocation: ${JSON.stringify(product.stockByLocation)}`);
        const otherLocations = product.stockByLocation.filter(loc => loc.locationId !== locationId && loc.stock >= item.quantity);
        console.log(`Sites alternatifs filtrés: ${JSON.stringify(otherLocations)}`);
        const alternativeSites = otherLocations.map(loc => {
          const altLocation = supermarketObj.locations.find(l => {
            const locId = l._id instanceof mongoose.Types.ObjectId ? l._id.toString() : l._id;
            return locId === loc.locationId;
          });
          const distance = calculateDistance(location.latitude, location.longitude, altLocation.latitude, altLocation.longitude);
          return {
            locationId: loc.locationId,
            stock: loc.stock,
            additionalFee: Math.round(200 + 50 * distance),
          };
        });
        console.log(`Sites alternatifs finaux: ${JSON.stringify(alternativeSites)}`);

        stockIssues.push({
          productId: item.productId,
          productName: product.name,
          requestedQuantity: item.quantity,
          availableStock: stock ? stock.stock : 0,
          substitutes: substitutes.map(sub => ({ id: sub._id, name: sub.name, price: sub.price })),
          alternativeSites,
        });
      } else {
        totalAmount += product.price * item.quantity;
        totalWeight += (product.weight || 1) * item.quantity;
        updatedProducts.push({
          productId: item.productId,
          quantity: item.quantity,
          alternativeLocationId: item.alternativeLocationId,
        });
        console.log(`Produit ${item.productId} ajouté à la commande, montant: ${product.price * item.quantity}, poids: ${(product.weight || 1) * item.quantity}`);
      }
    }

    if (stockIssues.length > 0) {
      console.log('Problèmes de stock détectés:', JSON.stringify(stockIssues));
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
          totalAmount,
          deliveryFee: deliveryType === 'evening' ? 400 : 500,
        },
      });
    }

    let deliveryFee = deliveryType === 'evening' ? 400 : 500;
    if (deliveryType !== 'evening') {
      const distance = calculateDistance(location.latitude, location.longitude, deliveryAddress.lat || 6.1725, deliveryAddress.lng || 1.2314);
      const distanceFee = distance > 5 ? (distance - 5) * 100 : 0;
      const weightFee = totalWeight > 5 ? (totalWeight - 5) * 50 : 0;
      deliveryFee += distanceFee + weightFee;
      console.log(`Frais de livraison calculés: base=500, distanceFee=${distanceFee}, weightFee=${weightFee}, total=${deliveryFee}`);
    }

    if (totalAmount < 0) {
      console.log('Montant total négatif détecté:', totalAmount);
      return res.status(400).json({ message: 'Le montant total ne peut pas être négatif' });
    }
    if (deliveryFee < 0) {
      console.log('Frais de livraison négatifs détectés:', deliveryFee);
      return res.status(400).json({ message: 'Les frais de livraison ne peuvent pas être négatifs' });
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

    const updatedDeliveryAddress = {
      address: deliveryAddress.address,
      lat: deliveryAddress.lat || 6.1725,
      lng: deliveryAddress.lng || 1.2314,
    };

    const order = new Order({
      clientId: req.user.id,
      supermarketId,
      locationId,
      products: updatedProducts,
      totalAmount,
      deliveryFee,
      additionalFees,
      deliveryAddress: updatedDeliveryAddress,
      scheduledDeliveryTime,
      deliveryType: deliveryType || 'standard',
      comments,
      queuePosition,
      assignedManager,
      status: orderStatus,
    });

    try {
      await order.save();
      console.log('Commande sauvegardée avec succès, _id:', order._id);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la commande:', error.message);
      throw error;
    }

    await sendNotification(req.user.id, `Votre commande est en attente (position ${queuePosition})`);
    console.log(`Notification envoyée au client ${req.user.id}`);

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

    if (req.user.role !== 'admin' && !(req.user.role === 'order_validator' && req.user.supermarketId === supermarketId)) {
      console.log(`Accès refusé pour utilisateur ${req.user.id}, rôle: ${req.user.role}, supermarketId: ${req.user.supermarketId}`);
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au validateur de commandes' });
    }

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
    console.log(`Récupération du panier pour utilisateur ${userId}`);

    const order = await Order.findOne({
      clientId: userId,
      status: { $in: ['pending_validation', 'awaiting_validator'] },
    })
      .populate('products.productId')
      .populate('supermarketId');

    if (!order) {
      console.log(`Aucune commande en cours trouvée pour utilisateur ${userId}`);
      return res.status(200).json({ message: 'Aucune commande en cours', order: null });
    }

    console.log(`Commande en cours récupérée pour utilisateur ${userId}:`, order._id);
    res.status(200).json(order);
  } catch (error) {
    console.error('Erreur lors de la récupération du panier:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération du panier', error: error.message });
  }
};

// Récupérer une commande spécifique
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Récupération de la commande ${id}`);

    const order = await Order.findById(id)
      .populate('products.productId')
      .populate('supermarketId');

    if (!order) {
      console.log(`Commande non trouvée pour _id ${id}`);
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (req.user.role !== 'admin' && order.clientId.toString() !== req.user.id) {
      console.log(`Utilisateur ${req.user.id} non autorisé à accéder à la commande ${id}`);
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    console.log(`Commande récupérée pour _id ${id}`);
    res.status(200).json(order);
  } catch (error) {
    console.error('Erreur lors de la récupération de la commande:', error.message);
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

// Mettre à jour une commande (modifier quantités, supprimer produits)
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { products } = req.body;

    console.log(`Mise à jour de la commande ${id} avec nouveaux produits:`, products);

    let order = await Order.findById(id).populate('products.productId');
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

    if (!products || !Array.isArray(products)) {
      console.log('Produits invalides dans la requête:', products);
      return res.status(400).json({ message: 'Liste de produits requise' });
    }

    const supermarket = await Supermarket.findById(order.supermarketId);
    if (!supermarket) {
      console.log('Supermarché non trouvé pour _id:', order.supermarketId);
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    const supermarketObj = supermarket.toObject();
    const location = supermarketObj.locations.find(loc => loc._id.toString() === order.locationId);
    if (!location) {
      console.log(`Site ${order.locationId} non trouvé dans les sites du supermarché`);
      return res.status(400).json({ message: `Site ${order.locationId} invalide pour ce supermarché` });
    }

    let totalAmount = 0;
    let totalWeight = 0;
    let additionalFees = 0;
    const stockIssues = [];
    const updatedProducts = [];

    for (const item of products) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        console.log('Produit invalide:', item);
        return res.status(400).json({ message: 'Chaque produit doit avoir un productId et une quantité positive' });
      }

      const product = await Product.findById(item.productId);
      if (!product) {
        console.log('Produit non trouvé pour _id:', item.productId);
        return res.status(404).json({ message: `Produit ${item.productId} non trouvé` });
      }

      if (product.supermarketId.toString() !== order.supermarketId.toString()) {
        console.log(`Produit ${item.productId} n’appartient pas au supermarché ${order.supermarketId}`);
        return res.status(400).json({ message: `Produit ${item.productId} n’appartient pas à ce supermarché` });
      }

      let stockLocationId = order.locationId;
      let itemAdditionalFee = 0;
      if (item.alternativeLocationId) {
        stockLocationId = item.alternativeLocationId;
        const altLocation = supermarketObj.locations.find(loc => loc._id.toString() === stockLocationId);
        if (!altLocation) {
          console.log(`Site alternatif ${stockLocationId} invalide`);
          return res.status(400).json({ message: `Site alternatif ${stockLocationId} invalide` });
        }
        const distance = calculateDistance(location.latitude, location.longitude, altLocation.latitude, altLocation.longitude);
        itemAdditionalFee = 200 + 50 * distance;
        additionalFees += itemAdditionalFee;
        console.log(`Frais supplémentaires pour ${item.productId} à ${stockLocationId}: ${itemAdditionalFee} FCFA`);
      }

      const stock = product.stockByLocation.find(loc => loc.locationId === stockLocationId);
      if (!stock || stock.stock < item.quantity) {
        console.log(`Rupture de stock pour productId: ${item.productId}, locationId: ${stockLocationId}`);
        const substitutes = await Product.find({
          supermarketId: order.supermarketId,
          category: product.category,
          _id: { $ne: product._id },
          stockByLocation: {
            $elemMatch: { locationId: order.locationId, stock: { $gte: item.quantity } }
          }
        }).limit(3);

        const otherLocations = product.stockByLocation.filter(loc => loc.locationId !== order.locationId && loc.stock >= item.quantity);
        const alternativeSites = otherLocations.map(loc => {
          const altLocation = supermarketObj.locations.find(l => l._id.toString() === loc.locationId);
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
        totalAmount += product.price * item.quantity;
        totalWeight += (product.weight || 1) * item.quantity;
        updatedProducts.push({
          productId: item.productId,
          quantity: item.quantity,
          alternativeLocationId: item.alternativeLocationId,
        });
      }
    }

    if (stockIssues.length > 0) {
      console.log('Problèmes de stock détectés lors de la mise à jour:', JSON.stringify(stockIssues));
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
          totalAmount,
          deliveryFee: order.deliveryFee,
        },
      });
    }

    let deliveryFee = order.deliveryFee;
    if (order.deliveryType !== 'evening') {
      const distance = calculateDistance(location.latitude, location.longitude, order.deliveryAddress.lat || 6.1725, order.deliveryAddress.lng || 1.2314);
      const distanceFee = distance > 5 ? (distance - 5) * 100 : 0;
      const weightFee = totalWeight > 5 ? (totalWeight - 5) * 50 : 0;
      deliveryFee = 500 + distanceFee + weightFee;
      console.log(`Frais de livraison recalculés: base=500, distanceFee=${distanceFee}, weightFee=${weightFee}, total=${deliveryFee}`);
    }

    order.products = updatedProducts;
    order.totalAmount = totalAmount;
    order.deliveryFee = deliveryFee;
    order.additionalFees = additionalFees;
    await order.save();

    console.log(`Commande ${id} mise à jour avec succès`);
    res.status(200).json(order);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la commande:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la commande', error: error.message });
  }
};

// Mettre à jour le statut d'une commande
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

    if (req.user.role !== 'admin' && !(req.user.role === 'order_validator' && req.user.supermarketId === order.supermarketId.toString())) {
      console.log(`Accès refusé pour utilisateur ${req.user.id}, rôle: ${req.user.role}, supermarketId: ${req.user.supermarketId}`);
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au validateur de commandes' });
    }

    const validStatuses = ['pending_validation', 'awaiting_validator', 'validated', 'in_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      console.log(`Statut invalide: ${status}`);
      return res.status(400).json({ message: 'Statut invalide' });
    }

    if (status === 'validated') {
      const payment = await Payment.findOne({ orderId: id });
      if (!payment || payment.status !== 'completed') {
        console.log(`Paiement non complété pour la commande ${id}`);
        return res.status(400).json({ message: 'Le paiement doit être complété avant de valider la commande' });
      }
    }

    if (status === 'validated' && order.status !== 'validated' && !order.driverId) {
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

      const driverId = await assignDriver(order._id);
      console.log(`Livreur assigné, driverId: ${driverId}`);
      order.driverId = driverId;
      order.status = 'in_delivery';
    } else if (status === 'delivered' && order.status === 'in_delivery') {
      order.status = status;

      if (order.driverId) {
        const driver = await Driver.findOne({ _id: new mongoose.Types.ObjectId(order.driverId) });
        if (driver) {
          driver.status = 'available';
          driver.earnings = (driver.earnings || 0) + order.deliveryFee;
          await driver.save();
          console.log(`Livreur mis à jour: ${driver._id}, status: ${driver.status}, earnings: ${driver.earnings}`);
        } else {
          console.log(`Livreur non trouvé pour driverId: ${order.driverId}`);
        }
      } else {
        console.log('Aucun driverId trouvé pour cette commande');
      }
    } else {
      order.status = status;
      console.log(`Commande mise à jour directement avec statut ${status}:`, order);
    }

    await order.save();
    console.log(`Commande sauvegardée après mise à jour:`, order);

    await sendNotification(order.clientId, `Votre commande est maintenant ${order.status}`);
    console.log(`Notification envoyée au client ${order.clientId} pour le statut ${order.status}`);

    res.status(200).json(order);
  } catch (error) {
    console.error('Erreur dans updateOrderStatus:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la commande', error: error.message });
  }
};