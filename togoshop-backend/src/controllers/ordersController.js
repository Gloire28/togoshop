const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Supermarket = require('../models/Supermarket');
const Driver = require('../models/Driver');
const { assignManager } = require('../services/managerOptimizer');
const { assignDriver } = require('../services/optimizer');
const { sendNotification } = require('../services/notifications');

// Fonction utilitaire pour calculer la distance (approximation simple)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // Distance en km, arrondie
};

exports.createOrder = async (req, res) => {
  try {
    const { products, supermarketId, locationId, deliveryAddress, scheduledDeliveryTime, deliveryType, comments } = req.body;

    // Vérifier les champs requis
    if (!products || !Array.isArray(products) || products.length === 0 || !supermarketId || !locationId || !deliveryAddress || !deliveryAddress.address) {
      return res.status(400).json({ message: 'Produits, supermarché, site et adresse de livraison sont requis' });
    }

    // Log pour vérifier l'ID du supermarché
    console.log('Recherche du supermarché avec _id:', supermarketId);

    // Utiliser findById pour une recherche plus robuste
    const supermarket = await Supermarket.findById(supermarketId);
    if (!supermarket) {
      console.log('Supermarché non trouvé pour _id:', supermarketId);
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    // Convertir le document Mongoose en objet JavaScript pur
    const supermarketObj = supermarket.toObject();

    // Log pour vérifier le supermarché récupéré
    console.log('Supermarché récupéré (après toObject):', JSON.stringify(supermarketObj));

    // Vérifier que le champ sites existe
    console.log('Vérification de locations:', supermarketObj.locations);
    console.log('Type de locations:', Array.isArray(supermarketObj.locations) ? 'Tableau' : typeof supermarketObj.locations);
    if (!supermarketObj.locations || !Array.isArray(supermarketObj.locations)) {
      console.log('Aucun emplacement défini pour le supermarché:', supermarketId);
      return res.status(400).json({ message: 'Le supermarché n’a pas d’emplacements définis' });
    }

    // Log pour vérifier les sites récupérés
    console.log('Sites récupérés pour le supermarché:', JSON.stringify(supermarketObj.sites));

    // Vérifier que le locationId existe dans le supermarché
    const location = supermarketObj.locations.find(loc => {
      const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id;
      console.log(`Comparaison: locId=${locId}, locationId=${locationId}`);
      return locId === locationId;
    });
    if (!location) {
      console.log(`Site ${locationId} non trouvé dans les sites du supermarché`);
      return res.status(400).json({ message: `Site ${locationId} invalide pour ce supermarché` });
    }

    // Vérifier les stocks des produits
    let totalAmount = 0;
    let totalWeight = 0;
    let additionalFees = 0;
    const stockIssues = [];
    const updatedProducts = [];

    for (const item of products) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ message: 'Chaque produit doit avoir un productId et une quantité positive' });
      }

      // Rechercher le produit
      console.log('Recherche du produit avec _id:', item.productId);
      const product = await Product.findById(item.productId);
      if (!product) {
        console.log('Produit non trouvé pour _id:', item.productId);
        return res.status(404).json({ message: `Produit ${item.productId} non trouvé` });
      }
      console.log('Produit trouvé:', JSON.stringify(product));

      if (product.supermarketId.toString() !== supermarketId) {
        return res.status(400).json({ message: `Produit ${item.productId} n’appartient pas à ce supermarché` });
      }

      let stockLocationId = locationId;
      if (item.alternativeLocationId) {
        stockLocationId = item.alternativeLocationId;
        const altLocation = supermarketObj.sites.find(loc => {
          const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id;
          return locId === stockLocationId;
        });
        if (!altLocation) {
          return res.status(400).json({ message: `Site alternatif ${stockLocationId} invalide` });
        }
        const distance = calculateDistance(location.latitude, location.longitude, altLocation.latitude, altLocation.longitude);
        additionalFees += 200 + 50 * distance; // Base 200 + 50 par km
      }

      const stock = product.stockByLocation.find(loc => loc.locationId === stockLocationId);
      if (!stock || stock.stock < item.quantity) {
        // Recherche de substituts
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

        // Recherche de sites alternatifs
        console.log(`Recherche de sites alternatifs pour productId: ${item.productId}, stockByLocation: ${JSON.stringify(product.stockByLocation)}`);
        const otherLocations = product.stockByLocation.filter(loc => loc.locationId !== locationId && loc.stock >= item.quantity);
        console.log(`Sites alternatifs filtrés: ${JSON.stringify(otherLocations)}`);
        const alternativeSites = otherLocations.map(loc => {
          const altLocation = supermarketObj.sites.find(l => {
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
        totalWeight += (product.weight || 1) * item.quantity; // Poids par défaut : 1 kg
        updatedProducts.push(item);
      }
    }

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
          totalAmount,
          deliveryFee: deliveryType === 'evening' ? 400 : 500,
        },
      });
    }

    // Calculer les frais de livraison
    let deliveryFee = deliveryType === 'evening' ? 400 : 500; // Frais de base
    if (deliveryType !== 'evening') {
      const distance = calculateDistance(location.latitude, location.longitude, deliveryAddress.lat || 6.1725, deliveryAddress.lng || 1.2314);
      const distanceFee = distance > 5 ? (distance - 5) * 100 : 0;
      const weightFee = totalWeight > 5 ? (totalWeight - 5) * 50 : 0;
      deliveryFee += distanceFee + weightFee;
    }

    if (totalAmount < 0) {
      return res.status(400).json({ message: 'Le montant total ne peut pas être négatif' });
    }
    if (deliveryFee < 0) {
      return res.status(400).json({ message: 'Les frais de livraison ne peuvent pas être négatifs' });
    }

    // Calculer la file d'attente
    const pendingOrders = await Order.countDocuments({ supermarketId, locationId, status: { $in: ['pending_validation', 'awaiting_validator'] } });
    const queuePosition = pendingOrders + 1;

    // Assigner un validateur
    let assignedManager = null;
    try {
      assignedManager = await assignManager(String(supermarketId), String(locationId));
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

    // Créer la commande
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
    
    // Créer un paiement
    try {
      const transactionId = `${order._id}-${Date.now()}`;
      const payment = new Payment({
        orderId: order._id,
        clientId: req.user.id,
        amount: totalAmount + order.deliveryFee + order.additionalFees,
        method: 'wallet',
        transactionId,
      });
      await payment.save();
      console.log('Paiement sauvegardé avec succès, _id:', payment._id);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du paiement:', error.message);
      throw error;
    }

    // Notifier le client
    await sendNotification(req.user.id, `Votre commande est en attente (position ${queuePosition})`);

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

    // Vérifier les autorisations (admin ou validateur avec rôle "order_validator")
    if (req.user.role !== 'admin' && !(req.user.role === 'order_validator' && req.user.supermarketId === supermarketId)) {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au validateur de commandes' });
    }

    const orders = await Order.find({ supermarketId, status: { $in: ['pending_validation', 'awaiting_validator'] } })
      .populate('products.productId')
      .sort('createdAt');
    res.status(200).json(orders);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération des commandes', error: error.message });
  }
};

// Mettre à jour le statut d'une commande
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Récupérer la commande
    let order = await Order.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }
    console.log(`Commande récupérée pour _id ${id}:`, order);

    // Vérifier que le validateur est autorisé
    if (req.user.role !== 'admin' && !(req.user.role === 'order_validator' && req.user.supermarketId === order.supermarketId.toString())) {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au validateur de commandes' });
    }

    // Vérifier que le statut est valide
    const validStatuses = ['pending_validation', 'awaiting_validator', 'validated', 'in_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }

    // Mettre à jour le stock et assigner un livreur si la commande passe à 'validated'
    if (status === 'validated' && order.status !== 'validated' && !order.driverId) {
      for (const item of order.products) {
        console.log(`Traitement du produit ${item.productId} avec quantité ${item.quantity}`);

        // Récupérer le produit avec ObjectId
        const product = await Product.findOne({ _id: new mongoose.Types.ObjectId(item.productId) });
        console.log(`Produit récupéré pour productId ${item.productId}:`, product);
        if (!product) {
          return res.status(404).json({ 
            message: `Produit ${item.productId} non trouvé` 
          });
        }

        // Vérifier le stock pour l'emplacement
        const stockEntry = product.stockByLocation.find(loc => loc.locationId === order.locationId);
        console.log(`StockEntry pour locationId ${order.locationId}:`, stockEntry);
        if (!stockEntry) {
          return res.status(400).json({ 
            message: `Stock non trouvé pour le produit ${item.productId} à l'emplacement ${order.locationId}` 
          });
        }

        // Vérifier si le stock est suffisant
        console.log(`Vérification du stock: actuel=${stockEntry.stock}, demandé=${item.quantity}`);
        if (stockEntry.stock < item.quantity) {
          return res.status(400).json({ 
            message: `Stock insuffisant pour le produit ${item.productId} à l'emplacement ${order.locationId}. Stock actuel : ${stockEntry.stock}, Quantité demandée : ${item.quantity}` 
          });
        }

        // Mettre à jour le stock
        stockEntry.stock -= item.quantity;
        console.log(`Nouveau stock après décrémentation: ${stockEntry.stock}`);
        await product.save();
        console.log(`Produit sauvegardé après mise à jour du stock:`, product);
      }

      // Assigner un livreur (cela mettra le statut à 'in_delivery')
      const driverId = await assignDriver(order._id);
      console.log(`Livreur assigné, driverId: ${driverId}`);
      order.driverId = driverId;

      // Recharger la commande pour refléter les modifications faites par assignDriver
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(id) });
      console.log(`Commande rechargée après assignation du livreur:`, order);
    } else if (status === 'delivered' && order.status === 'in_delivery') {
      // Mettre à jour le statut de la commande
      order.status = status;

      // Mettre à jour le statut du livreur à "available" et ajouter les gains
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

      await order.save();
      console.log(`Commande sauvegardée après passage à 'delivered':`, order);
    } else {
      // Si le statut n'est pas 'validated' ou 'delivered', mettre à jour directement
      order.status = status;
      await order.save();
      console.log(`Commande mise à jour directement avec statut ${status}:`, order);
    }

    // Notifier le client
    await sendNotification(order.clientId, `Votre commande est maintenant ${order.status}`);
    console.log(`Notification envoyée au client ${order.clientId} pour le statut ${order.status}`);

    res.status(200).json(order);
  } catch (error) {
    console.error('Erreur dans updateOrderStatus:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la commande', error: error.message });
  }
};