const mongoose = require('mongoose');
const Order = require('../models/Order');
const { sendNotification } = require('../services/notifications');
const Promotion = require('../models/Promotion');

// Créer une nouvelle promotion
exports.createPromotion = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est un admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé à l\'administrateur' });
    }

    // Log pour déboguer req.body
    console.log('req.body:', req.body);

    // Vérifier le type de réduction
    const { discountType, startDate, endDate, minOrderAmount, maxUses, discountValue } = req.body;
    if (discountType && !['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ message: 'Type de réduction invalide (percentage ou fixed)' });
    }

    // Ajout de la validation pour discountValue
    if (discountValue !== undefined && discountValue < 0) {
      return res.status(400).json({ message: 'La valeur de la réduction ne peut pas être négative' });
    }

    // Vérifier les dates
    const now = new Date();
    if (startDate && new Date(startDate) < now) {
      return res.status(400).json({ message: 'La date de début ne peut pas être dans le passé' });
    }
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ message: 'La date de fin doit être après la date de début' });
    }

    // Créer la promotion en passant directement req.body
    const promotion = new Promotion({
      ...req.body,
      minOrderAmount: minOrderAmount || 0,
      maxUses: maxUses !== undefined ? maxUses : Number.MAX_SAFE_INTEGER,
    });

    await promotion.save();

    res.status(201).json({ message: 'Promotion créée avec succès', promotion });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création de la promotion', error: error.message });
  }
};

// Mettre à jour une promotion
exports.updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Vérifier si la promotion existe
    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée' });
    }

    // Vérifier si l'utilisateur a le droit de modifier cette promotion
    if (req.user.role !== 'admin' && promotion.supermarketId.toString() !== req.user.supermarketId) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Validation de la date de début si elle est fournie
    if (updateData.startDate) {
      const now = new Date();
      if (new Date(updateData.startDate) < now) {
        return res.status(400).json({ message: 'La date de début ne peut pas être dans le passé' });
      }
    }

    // Mettre à jour la promotion
    const updatedPromotion = await Promotion.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({ message: 'Promotion mise à jour avec succès', promotion: updatedPromotion });
  } catch (error) {
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
      $expr: { $lt: ['$currentUses', '$maxUses'] }, // Utilisation de $expr pour comparer deux champs
    });

    res.status(200).json(promotions);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des promotions', error: error.message });
  }
};

// Appliquer une promotion à une commande
exports.applyPromotion = async (req, res) => {
  try {
    const { orderId, promoCode } = req.body;

    // Trouver la commande
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    // Vérifier que l'utilisateur est le client de la commande
    if (req.user.role !== 'admin' && order.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Trouver la promotion
    const now = new Date();
    const promotion = await Promotion.findOne({
      code: promoCode,
      startDate: { $lte: now },
      endDate: { $gte: now },
      supermarketId: order.supermarketId,
      $expr: { $lt: ['$currentUses', '$maxUses'] }, // Utilisation de $expr pour comparer deux champs
    });

    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée ou non valide' });
    }

    // Vérifier le montant minimum
    const orderAmount = order.totalAmount + order.deliveryFee;
    if (orderAmount < promotion.minOrderAmount) {
      return res.status(400).json({ message: `Montant minimum de ${promotion.minOrderAmount} FCFA requis pour cette promotion` });
    }

    // Appliquer la réduction
    let discount = 0;
    if (promotion.discountType === 'percentage') {
      discount = (promotion.discountValue / 100) * orderAmount;
    } else {
      discount = promotion.discountValue;
    }

    order.totalAmount -= discount;
    if (order.totalAmount < 0) order.totalAmount = 0;

    // Mettre à jour l'utilisation de la promotion
    promotion.currentUses += 1;
    await promotion.save();

    await order.save();

    // Notifier le client
    await sendNotification(order.clientId, `Promotion ${promoCode} appliquée avec succès ! Réduction de ${discount} FCFA`);

    res.status(200).json({ message: 'Promotion appliquée avec succès', order });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de l'application de la promotion", error: error.message });
  }
};

// Supprimer une promotion
exports.deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si la promotion existe
    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée' });
    }

    // Vérifier si l'utilisateur a le droit de supprimer cette promotion
    if (req.user.role !== 'admin' && promotion.supermarketId.toString() !== req.user.supermarketId) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Supprimer la promotion
    await Promotion.findByIdAndDelete(id);

    res.json({ message: 'Promotion supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression de la promotion', error: error.message });
  }
};

module.exports = exports;