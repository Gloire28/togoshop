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

// Fonction utilitaire pour ajouter des points de fidélité
const addLoyaltyPoints = async (userId, points, description) => {
  try {
    let loyalty = await Loyalty.findOne({ userId });
    if (!loyalty) {
      loyalty = new Loyalty({ userId, points: 0, transactions: [] });
    }

    loyalty.points += points;
    loyalty.transactions.push({
      type: 'credit',
      points,
      description,
      date: new Date(),
    });

    await loyalty.save();
    console.log(`Points ajoutés pour userId ${userId}: ${points} points, description: ${description}`);
    return loyalty;
  } catch (error) {
    console.error('Erreur lors de l\'ajout des points de fidélité:', error.message);
    throw error;
  }
};

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

    order.totalAmount = order.products.reduce((total, item) => {
      const product = productData.find(p => p._id.toString() === item.productId.toString());
      return total + (item.quantity * (product?.price || 0));
    }, 0);

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

    // Validation des champs minimum requis
    if (!products || !Array.isArray(products) || products.length === 0 || !supermarketId || !locationId) {
      console.log('Champs manquants dans la requête:', { products, supermarketId, locationId, deliveryAddress });
      return res.status(400).json({ message: 'Produits, supermarché et site sont requis' });
    }

    // Définir clientId : admins peuvent spécifier un clientId, clients utilisent leur propre ID
    const orderClientId = req.user.role === 'admin' ? clientId : req.user.id;
    if (!orderClientId) {
      return res.status(400).json({ message: 'clientId est requis pour les administrateurs' });
    }

    console.log('User ID:', req.user.id, 'User Role:', req.user.role, 'Client ID:', orderClientId);

    // Recherche du supermarché
    const supermarket = await Supermarket.findById(supermarketId);
    if (!supermarket) {
      console.log('Supermarché non trouvé pour _id:', supermarketId);
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    const supermarketObj = supermarket.toObject();
    console.log('Supermarché récupéré (après toObject):', JSON.stringify(supermarketObj));

    // Vérification des emplacements du supermarché
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

    let totalAmount = 0;
    let totalWeight = 0;
    let additionalFees = 0;
    const stockIssues = [];
    const updatedProducts = [];

    // Vérification des produits et calcul du montant total
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
        const substitutes = await Product.find({
          supermarketId,
          category: product.category,
          _id: { $ne: product._id },
          stockByLocation: { $elemMatch: { locationId, stock: { $gte: item.quantity } } },
        }).limit(3);

        const otherLocations = product.stockByLocation.filter(loc => loc.locationId !== locationId && loc.stock >= item.quantity);
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
          alternativeLocationId: item.alternativeLocationId || '',
          comment: item.comment || '',
          photoUrl: item.photoUrl || '',
        });
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

    // Calcul des frais de livraison
    let deliveryFee = deliveryType === 'evening' ? 400 : 500;
    if (deliveryType !== 'evening' && deliveryAddress && deliveryAddress.lat && deliveryAddress.lng) {
      const distance = calculateDistance(location.latitude, location.longitude, deliveryAddress.lat, deliveryAddress.lng);
      const distanceFee = distance > 5 ? (distance - 5) * 100 : 0;
      const weightFee = totalWeight > 5 ? (totalWeight - 5) * 50 : 0;
      deliveryFee += distanceFee + weightFee;
      console.log(`Frais de livraison calculés: base=${deliveryType === 'evening' ? 400 : 500}, distanceFee=${distanceFee}, weightFee=${weightFee}, total=${deliveryFee}`);
    }

    if (totalAmount < 0) {
      console.log('Montant total négatif détecté:', totalAmount);
      return res.status(400).json({ message: 'Le montant total ne peut pas être négatif' });
    }
    if (deliveryFee < 0) {
      console.log('Frais de livraison négatifs détectés:', deliveryFee);
      return res.status(400).json({ message: 'Les frais de livraison ne peuvent pas être négatifs' });
    }

    // Calcul de la position dans la file d'attente
    const pendingOrders = await Order.countDocuments({ supermarketId, locationId, status: { $in: ['pending_validation', 'awaiting_validator'] } });
    const queuePosition = pendingOrders + 1;
    console.log(`Position dans la file d'attente: ${queuePosition}`);

    // Assignation d'un validateur (manager)
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

    // Création et sauvegarde de la commande
    const order = new Order({
      clientId: orderClientId,
      supermarketId,
      locationId,
      products: updatedProducts,
      totalAmount,
      deliveryFee,
      additionalFees,
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

    // Envoi d'une notification au client
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

    // Vérification des permissions (admin ou validateur)
    if (req.user.role !== 'admin' && !(req.user.role === 'order_validator' && req.user.supermarketId === supermarketId)) {
      console.log(`Accès refusé pour utilisateur ${req.user.id}, rôle: ${req.user.role}, supermarketId: ${req.user.supermarketId}`);
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au validateur de commandes' });
    }

    // Récupération des commandes en attente
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

    // Recherche uniquement les commandes en 'cart_in_progress'
    let order = await Order.findOne({
      clientId: userId,
      status: 'cart_in_progress', // Filtre strict sur cart_in_progress
    })
      .sort({ updatedAt: -1 }) // Trie par date de mise à jour décroissante
      .populate({
        path: 'products.productId',
        select: 'name price stockByLocation weight', // Sélectionner uniquement les champs nécessaires
      })
      .populate({
        path: 'supermarketId',
        select: 'name locations', // Sélectionner uniquement les champs nécessaires
      })
      .lean(); // Utiliser .lean() pour des performances accrues (retourne un objet JS simple)

    if (!order) {
      return res.status(200).json({ message: 'Aucune commande dans le panier', order: null });
    }

    // Vérifier et recalculer totalAmount si nécessaire
    const calculatedTotal = order.products.reduce((total, item) => {
      const productPrice = item.productId?.price || 0;
      return total + item.quantity * productPrice;
    }, 0);

    if (order.totalAmount !== calculatedTotal) {
      order.totalAmount = calculatedTotal;
      // Mettre à jour uniquement si nécessaire
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
// Récupérer toutes les commandes de l'utilisateur connecté (pour /api/orders/me)
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Récupération de toutes les commandes pour utilisateur ${userId}`);

    const orders = await Order.find({ clientId: userId })
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

// Mettre à jour une commande (modifier quantités, supprimer produits)
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { products, deliveryAddress } = req.body;

    console.log(`Mise à jour de la commande ${id} avec req.body:`, JSON.stringify(req.body));

    let order = await Order.findById(id).populate('products.productId');
    if (!order) {
      console.log(`Commande non trouvée pour _id ${id}`);
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (order.clientId.toString() !== req.user.id) {
      console.log(`Utilisateur ${req.user.id} non autorisé à modifier la commande ${id}`);
      return res.status(403).json({ message: 'Non autorisé à modifier cette commande' });
    }

    // Autoriser les modifications pour cart_in_progress, pending_validation, et awaiting_validator
    if (!['cart_in_progress', 'pending_validation', 'awaiting_validator'].includes(order.status)) {
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
          alternativeLocationId: item.alternativeLocationId || '',
          comment: item.comment || '',
          photoUrl: item.photoUrl || '',
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

    // Mettre à jour deliveryAddress si fourni
    if (deliveryAddress) {
      order.deliveryAddress = {
        address: deliveryAddress.address || order.deliveryAddress.address,
        lat: deliveryAddress.lat || order.deliveryAddress.lat,
        lng: deliveryAddress.lng || order.deliveryAddress.lng,
        instructions: deliveryAddress.instructions || order.deliveryAddress.instructions,
      };
      console.log(`deliveryAddress mis à jour:`, order.deliveryAddress);
    }

    let deliveryFee = order.deliveryFee;
    if (order.deliveryType !== 'evening') {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        order.deliveryAddress.lat || 6.1725,
        order.deliveryAddress.lng || 1.2314
      );
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

    // Recharger la commande pour renvoyer une réponse cohérente
    order = await Order.findById(id).populate('products.productId');
    console.log(`Commande ${id} mise à jour avec succès`);
    res.status(200).json(order);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la commande:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la commande', error: error.message });
  }
};

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

    // Vérification des permissions
    if (req.user.roles && !req.user.roles.includes('admin') && !(req.user.roles.includes('order_validator') && req.user.supermarketId && req.user.supermarketId.toString() === order.supermarketId.toString())) {
      // Exception pour les drivers qui mettent à jour leur propre commande à 'delivered'
      if (!(req.user.role === 'driver' && status === 'delivered' && order.driverId && order.driverId.toString() === req.user.id)) {
        console.log(`Accès refusé pour utilisateur ${req.user.id}, rôles: ${req.user.roles}, supermarketId: ${req.user.supermarketId}`);
        return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au validateur de commandes' });
      }
      console.log(`Accès autorisé: Driver ${req.user.id} met à jour sa propre commande à 'delivered'`);
    }

    // Définition des transitions de statut valides
    const statusTransitions = {
      'pending_validation': ['validated', 'cancelled'],
      'awaiting_validator': ['pending_validation', 'cancelled'],
      'validated': ['in_delivery', 'cancelled'],
      'in_delivery': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': [],
    };

    // Validation du nouveau statut
    const validStatuses = ['pending_validation', 'awaiting_validator', 'validated', 'in_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      console.log(`Statut invalide: ${status}`);
      return res.status(400).json({ message: 'Statut invalide' });
    }

    // Vérification des transitions de statut
    const allowedTransitions = statusTransitions[order.status] || [];
    if (!allowedTransitions.includes(status)) {
      console.log(`Transition de statut non autorisée: de ${order.status} à ${status}`);
      return res.status(400).json({ message: `Transition de statut non autorisée: de ${order.status} à ${status}` });
    }

    // Vérification du paiement pour le statut 'validated'
    if (status === 'validated') {
      const payment = await Payment.findOne({ orderId: id });
      if (!payment || payment.status !== 'completed') {
        console.log(`Paiement non complété pour la commande ${id}`);
        return res.status(400).json({ message: 'Le paiement doit être complété avant de valider la commande' });
      }
    }

    // Gestion des transitions spécifiques
    if (status === 'validated' && order.status !== 'validated') {
      // Mise à jour du stock
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

    // Assignation du livreur lors du passage à in_delivery
    if (status === 'in_delivery' && !order.driverId) {
      try {
        const supermarket = await Supermarket.findOne({ _id: order.supermarketId });
        if (!supermarket) {
          console.log(`Supermarché ${order.supermarketId} non trouvé`);
          return res.status(404).json({ message: 'Supermarché non trouvé' });
        }

        const location = supermarket.locations.find(loc => loc._id === order.locationId);
        if (!location) {
          console.log(`Emplacement ${order.locationId} non trouvé pour le supermarché ${order.supermarketId}`);
          return res.status(404).json({ message: 'Emplacement non trouvé pour ce supermarché' });
        }

        const supermarketLocation = { lat: location.latitude, lng: location.longitude };
        console.log(`Position du supermarché:`, supermarketLocation);

        const managerLocation = req.user.location || { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng };
        console.log(`Position du manager:`, managerLocation);

        const driverId = await assignDriver(order._id, managerLocation);
        console.log(`Livreur assigné, driverId: ${driverId}`);
        order.driverId = driverId;
      } catch (error) {
        console.error('Erreur lors de l\'assignation du livreur:', error.message);
        return res.status(500).json({ message: 'Erreur lors de l’assignation du livreur', error: error.message });
      }
    } else if (status === 'delivered') {
      order.status = status;

      // Ajout des points de fidélité
      const points = Math.floor(order.totalAmount / 2000); // 1 point par 2000 FCFA
      console.log(`Ajout de ${points} points de fidélité pour la commande ${id} avec montant ${order.totalAmount}`);

      try {
        await loyaltyController.addPoints({
          user: { id: order.clientId.toString(), role: 'client' },
          body: {
            points: points,
            description: `Commande livrée (ID: ${order._id})`,
            fromOrder: true
          }
        }, {
          status: (code) => ({ json: (data) => console.log('Réponse ajout points:', data) }),
          json: (data) => console.log('Réponse ajout points:', data)
        });
        console.log(`Points ajoutés avec succès pour l'utilisateur ${order.clientId}`);
      } catch (error) {
        console.error('Erreur lors de l’ajout des points:', error.message);
      }

      await sendNotification(
        order.clientId,
        `Votre commande (ID: ${order._id}) a été livrée ! Vous avez gagné ${points} points de fidélité.`
      );

      // Mise à jour du livreur (si présent)
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
        console.log('Aucun driverId trouvé pour cette commande, points ajoutés malgré tout');
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
exports.uploadPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, comment } = req.body;

    // Vérifier que productId est présent
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

    // Mettre à jour ou réinitialiser le commentaire
    if (comment) {
      product.comment = comment;
      console.log(`Commentaire ajouté pour le produit ${productId}: ${comment}`);
    } else {
      product.comment = null; // Réinitialiser à null si aucun commentaire n'est fourni
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
    const order = await Order.findById(id);
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

    // Calculer la position dans la file d'attente
    const pendingOrders = await Order.countDocuments({
      supermarketId: order.supermarketId,
      locationId: order.locationId,
      status: { $in: ['pending_validation', 'awaiting_validator'] },
    });
    const queuePosition = pendingOrders + 1;
    console.log(`Position dans la file d'attente: ${queuePosition}`);

    // Tenter d'assigner un manager
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

    // Notifier le client
    await sendNotification(
      order.clientId,
      `Votre commande (ID: ${order._id}) a été soumise. Position dans la file : ${queuePosition}. Statut : ${newStatus}`
    );
    console.log(`Notification envoyée au client ${order.clientId}`);

    // Notifier le manager si assigné
    if (assignedManager) {
      await sendNotification(assignedManager, `Nouvelle commande (ID: ${order._id}) à valider.`);
      console.log(`Notification envoyée au manager ${assignedManager}`);
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Erreur lors de la soumission de la commande:', error.message);
    res.status(500).json({ message: 'Erreur lors de la soumission de la commande', error: error.message });
  }
};