const mongoose = require('mongoose');
const Queue = require('bull');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { sendNotification } = require('../services/notifications');
const Promotion = require('../models/Promotion');

// Configuration de la file d'attente pour les notifications
const notificationQueue = new Queue('notifications', {
  redis: { host: '127.0.0.1', port: 6379 },
});

// Générer un code unique pour la promotion
const generateUniqueCode = async () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let isUnique = false;
  const maxAttempts = 10;
  let attempts = 0;

  while (!isUnique && attempts < maxAttempts) {
    code = `PROMO-${Array.from({ length: 8 }, () => characters[Math.floor(Math.random() * characters.length)]).join('')}`;
    const existing = await Promotion.findOne({ code });
    if (!existing) isUnique = true;
    attempts++;
  }

  if (!isUnique) throw new Error('Impossible de générer un code unique après plusieurs tentatives');
  return code;
};

// Créer une nouvelle promotion
exports.createPromotion = async (req, res) => {
  try {
    const allowedRoles = ['admin', 'manager', 'order_validator', 'stock_manager'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès réservé aux administrateurs ou managers' });
    }

    const { discountType, startDate, endDate, minOrderAmount, maxUses, discountValue, supermarketId, productId, code, title, description } = req.body;

    if (!supermarketId || !title || !description || !discountType || discountValue === undefined || !startDate || !endDate) {
      return res.status(400).json({ message: 'supermarketId, title, description, discountType, discountValue, startDate, et endDate sont requis' });
    }

    if (req.user.role !== 'admin' && supermarketId.toString() !== req.user.supermarketId.toString()) {
      return res.status(403).json({ message: 'Vous ne pouvez créer des promotions que pour votre supermarché' });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ message: 'Type de réduction invalide (percentage ou fixed)' });
    }

    if (discountValue < 0) {
      return res.status(400).json({ message: 'La valeur de la réduction ne peut pas être négative' });
    }

    const now = new Date();
    if (new Date(startDate) < now) {
      return res.status(400).json({ message: 'La date de début ne peut pas être dans le passé' });
    }
    if (new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ message: 'La date de fin doit être après la date de début' });
    }

    let promotedPrice = null;
    if (productId) {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Produit non trouvé' });
      }
      if (product.supermarketId.toString() !== supermarketId.toString()) {
        return res.status(400).json({ message: 'Le produit n’appartient pas à ce supermarché' });
      }
      if (discountType === 'fixed' && discountValue > product.price) {
        return res.status(400).json({ message: 'La réduction fixe ne peut pas dépasser le prix du produit' });
      }
      promotedPrice = discountType === 'fixed'
        ? Math.max(0, product.price - discountValue)
        : product.price * (1 - discountValue / 100);
      promotedPrice = Math.round(promotedPrice);
    }

    const finalCode = code || (await generateUniqueCode());

    const promotion = new Promotion({
      supermarketId,
      productId,
      title,
      description,
      code: finalCode,
      discountType,
      discountValue,
      promotedPrice,
      minOrderAmount: minOrderAmount || 0,
      maxUses: maxUses !== undefined ? maxUses : Number.MAX_SAFE_INTEGER,
      startDate,
      endDate,
      createdBy: req.user.id,
    });

    await promotion.save();

    if (productId && promotedPrice !== null) {
      await Product.updateOne(
        { _id: productId },
        { $set: { promotedPrice, activePromotion: promotion._id } }
      );
    }

    const clientIds = await Order.distinct('clientId', { supermarketId });
    const productName = productId ? (await Product.findById(productId)).name : null;
    const message = productName
      ? `Nouvelle promotion sur ${productName} ! Code: ${finalCode} pour ${discountValue}${discountType === 'percentage' ? '%' : ' FCFA'} de réduction. Valide jusqu'au ${new Date(endDate).toLocaleDateString()}.`
      : `Nouvelle promotion ! Code: ${finalCode} pour ${discountValue}${discountType === 'percentage' ? '%' : ' FCFA'} de réduction. Valide jusqu'au ${new Date(endDate).toLocaleDateString()}.`;

    for (const clientId of clientIds) {
      await notificationQueue.add({ clientId, message });
    }

    console.log(`Promotion créée: ${promotion._id}, code: ${finalCode}, promotedPrice: ${promotedPrice}`);

    res.status(201).json({ message: 'Promotion créée avec succès', promotion });
  } catch (error) {
    console.error('Erreur lors de la création de la promotion:', error.message);
    res.status(500).json({ message: 'Erreur lors de la création de la promotion', error: error.message });
  }
};

// Mettre à jour une promotion
exports.updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée' });
    }

    if (req.user.role !== 'admin' && promotion.supermarketId.toString() !== req.user.supermarketId.toString()) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const allowedFields = ['title', 'description', 'discountType', 'discountValue', 'minOrderAmount', 'maxUses', 'startDate', 'endDate', 'isActive', 'productId'];
    const filteredUpdateData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => ({ ...obj, [key]: updateData[key] }), {});

    if (filteredUpdateData.startDate && new Date(filteredUpdateData.startDate) < new Date()) {
      return res.status(400).json({ message: 'La date de début ne peut pas être dans le passé' });
    }
    if (filteredUpdateData.startDate && filteredUpdateData.endDate && new Date(filteredUpdateData.endDate) <= new Date(filteredUpdateData.startDate)) {
      return res.status(400).json({ message: 'La date de fin doit être après la date de début' });
    }

    let promotedPrice = promotion.promotedPrice;
    if (filteredUpdateData.productId || filteredUpdateData.discountType || filteredUpdateData.discountValue) {
      const productId = filteredUpdateData.productId || promotion.productId;
      if (productId) {
        const product = await Product.findById(productId);
        if (!product) {
          return res.status(404).json({ message: 'Produit non trouvé' });
        }
        if (product.supermarketId.toString() !== promotion.supermarketId.toString()) {
          return res.status(400).json({ message: 'Le produit n’appartient pas à ce supermarché' });
        }
        const discountType = filteredUpdateData.discountType || promotion.discountType;
        const discountValue = filteredUpdateData.discountValue !== undefined ? filteredUpdateData.discountValue : promotion.discountValue;
        if (discountType === 'fixed' && discountValue > product.price) {
          return res.status(400).json({ message: 'La réduction fixe ne peut pas dépasser le prix du produit' });
        }
        promotedPrice = discountType === 'fixed'
          ? Math.max(0, product.price - discountValue)
          : product.price * (1 - discountValue / 100);
        promotedPrice = Math.round(promotedPrice);
      } else {
        promotedPrice = null;
      }
    }

    filteredUpdateData.promotedPrice = promotedPrice;

    const updatedPromotion = await Promotion.findByIdAndUpdate(id, filteredUpdateData, {
      new: true,
      runValidators: true,
    });

    if (updatedPromotion.productId) {
      await Product.updateOne(
        { _id: updatedPromotion.productId },
        { $set: { promotedPrice: updatedPromotion.promotedPrice, activePromotion: updatedPromotion._id } }
      );
    } else if (promotion.productId && (!filteredUpdateData.productId || filteredUpdateData.isActive === false)) {
      await Product.updateOne(
        { _id: promotion.productId },
        { $set: { promotedPrice: null, activePromotion: null } }
      );
    }

    console.log(`Promotion mise à jour: ${updatedPromotion._id}, promotedPrice: ${promotedPrice}`);

    res.json({ message: 'Promotion mise à jour avec succès', promotion: updatedPromotion });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la promotion:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la promotion', error: error.message });
  }
};

// Lister les promotions actives
exports.getActivePromotions = async (req, res) => {
  try {
    const now = new Date();
    const promotions = await Promotion.find({
      startDate: { $lte: now },
      endDate: { $gte: now },
      $expr: { $lt: ['$currentUses', '$maxUses'] },
      isActive: true,
    })
      .populate('productId', 'name price')
      .limit(100); // Pagination basique

    res.status(200).json(promotions);
  } catch (error) {
    console.error('Erreur lors de la récupération des promotions:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération des promotions', error: error.message });
  }
};

// Lister les promotions par supermarché
exports.getPromotionsBySupermarket = async (req, res) => {
  try {
    const { supermarketId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(supermarketId)) {
      return res.status(400).json({ message: 'ID du supermarché invalide' });
    }

    const now = new Date();
    const promotions = await Promotion.find({
      supermarketId,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $expr: { $lt: ['$currentUses', '$maxUses'] },
      isActive: true,
    })
      .populate('productId', 'name price')
      .limit(100); // Pagination basique

    res.status(200).json(promotions);
  } catch (error) {
    console.error('Erreur lors de la récupération des promotions par supermarché:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération des promotions', error: error.message });
  }
};

// Appliquer une promotion à une commande
exports.applyPromotion = async (req, res) => {
  try {
    const { orderId, promoCode } = req.body;

    const order = await Order.findById(orderId).populate('products.productId');
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (req.user.role !== 'admin' && order.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const now = new Date();
    const promotion = await Promotion.findOne({
      code: promoCode,
      supermarketId: order.supermarketId,
      $expr: { $lt: ['$currentUses', '$maxUses'] },
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true,
    }).populate('productId');

    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée ou non valide' });
    }

    if (order.appliedPromotions && order.appliedPromotions.some(p => p.promotionId.toString() === promotion._id.toString())) {
      return res.status(400).json({ message: 'Cette promotion est déjà appliquée' });
    }

    const orderAmount = order.totalAmount;
    if (orderAmount < promotion.minOrderAmount) {
      return res.status(400).json({ message: `Montant minimum de ${promotion.minOrderAmount} FCFA requis pour cette promotion` });
    }

    let discount = 0;
    if (promotion.productId && promotion.promotedPrice !== null) {
      const orderProduct = order.products.find(p => p.productId._id.toString() === promotion.productId._id.toString());
      if (!orderProduct) {
        return res.status(400).json({ message: 'Le produit de la promotion n’est pas dans la commande' });
      }
      const originalPrice = orderProduct.productId.price;
      discount = (originalPrice - promotion.promotedPrice) * orderProduct.quantity;
      orderProduct.promotedPrice = promotion.promotedPrice;
    } else {
      discount = promotion.discountType === 'percentage'
        ? (promotion.discountValue / 100) * orderAmount
        : promotion.discountValue;
    }

    if (discount > orderAmount) discount = orderAmount;

    order.appliedPromotions = order.appliedPromotions || [];
    order.appliedPromotions.push({ promotionId: promotion._id, discount });
    order.totalAmount = Math.max(0, order.totalAmount - discount);
    promotion.currentUses += 1;

    await Promise.all([promotion.save(), order.save()]);

    const productName = promotion.productId ? promotion.productId.name : null;
    const notificationMessage = productName
      ? `Promotion ${promoCode} appliquée sur ${productName} ! Réduction de ${discount} FCFA`
      : `Promotion ${promoCode} appliquée ! Réduction de ${discount} FCFA`;
    await notificationQueue.add({ clientId: order.clientId, message: notificationMessage });

    console.log(`Promotion appliquée: ${promotion._id}, commande: ${orderId}, réduction: ${discount} FCFA`);

    res.status(200).json({ message: 'Promotion appliquée avec succès', order });
  } catch (error) {
    console.error('Erreur dans applyPromotion:', error.message);
    res.status(500).json({ message: 'Erreur lors de l’application de la promotion', error: error.message });
  }
};

// Supprimer une promotion
exports.deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;

    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée' });
    }

    if (req.user.role !== 'admin' && promotion.supermarketId.toString() !== req.user.supermarketId.toString()) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    if (promotion.productId) {
      await Product.updateOne(
        { _id: promotion.productId },
        { $set: { promotedPrice: null, activePromotion: null } }
      );
    }

    await Promotion.findByIdAndDelete(id);

    console.log(`Promotion supprimée: ${id}`);

    res.json({ message: 'Promotion supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la promotion:', error.message);
    res.status(500).json({ message: 'Erreur lors de la suppression de la promotion', error: error.message });
  }
};

// Travailleur de file d'attente pour les notifications
notificationQueue.process(async (job) => {
  try {
    await sendNotification(job.data.clientId, job.data.message);
    console.log(`Notification envoyée à ${job.data.clientId}`);
  } catch (error) {
    console.error(`Erreur lors de l'envoi de la notification à ${job.data.clientId}:`, error.message);
  }
});

module.exports = exports;