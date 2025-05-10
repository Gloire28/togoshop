const mongoose = require('mongoose');
const Order = require('../models/Order');
const { sendNotification } = require('../services/notifications');
const Promotion = require('../models/Promotion');

// Créer une nouvelle promotion
exports.createPromotion = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé à l\'administrateur' });
    }

    console.log('req.body:', req.body);

    const { discountType, startDate, endDate, minOrderAmount, maxUses, discountValue, supermarketId } = req.body;
    if (!supermarketId) {
      return res.status(400).json({ message: 'supermarketId est requis' });
    }
    if (discountType && !['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ message: 'Type de réduction invalide (percentage ou fixed)' });
    }
    if (discountValue !== undefined && discountValue < 0) {
      return res.status(400).json({ message: 'La valeur de la réduction ne peut pas être négative' });
    }
    const now = new Date();
    if (startDate && new Date(startDate) < now) {
      return res.status(400).json({ message: 'La date de début ne peut pas être dans le passé' });
    }
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ message: 'La date de fin doit être après la date de début' });
    }

    const promotion = new Promotion({
      ...req.body,
      minOrderAmount: minOrderAmount || 0,
      maxUses: maxUses !== undefined ? maxUses : Number.MAX_SAFE_INTEGER,
    });

    await promotion.save();
    console.log('Promotion sauvegardée avec succès:', promotion);

    const User = require('../models/User');
    const clients = await User.find({ role: 'client' });
    for (const client of clients) {
      await sendNotification(client._id, `Nouvelle promotion disponible ! Utilisez le code ${promotion.code} pour bénéficier de ${promotion.discountValue}${promotion.discountType === 'percentage' ? '%' : ' FCFA'} de réduction. Valide jusqu'au ${new Date(promotion.endDate).toLocaleDateString()}.`);
    }

    res.status(201).json({ message: 'Promotion créée avec succès', promotion });
  } catch (error) {
    console.error('Erreur lors de la création de la promotion:', error);
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

    if (req.user.role !== 'admin' && promotion.supermarketId.toString() !== req.user.supermarketId) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    if (updateData.startDate && new Date(updateData.startDate) < new Date()) {
      return res.status(400).json({ message: 'La date de début ne peut pas être dans le passé' });
    }
    if (updateData.startDate && updateData.endDate && new Date(updateData.endDate) <= new Date(updateData.startDate)) {
      return res.status(400).json({ message: 'La date de fin doit être après la date de début' });
    }

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
      $expr: { $lt: ['$currentUses', '$maxUses'] },
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
    console.log('--- Début applyPromotion ---');
    console.log('Requête reçue:', { orderId, promoCode, user: req.user });

    const order = await Order.findById(orderId);
    console.log('Commande trouvée:', order);
    if (!order) {
      console.log('Erreur: Commande non trouvée');
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (req.user.role !== 'admin' && order.clientId.toString() !== req.user.id) {
      console.log('Accès refusé: Utilisateur non autorisé', { userId: req.user.id, clientId: order.clientId });
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const now = new Date();
    console.log('Date actuelle:', now);
    const promotion = await Promotion.findOne({
      code: promoCode,
      supermarketId: order.supermarketId,
      $expr: { $lt: ['$currentUses', '$maxUses'] },
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
    console.log('Promotion trouvée:', promotion);

    if (!promotion) {
      console.log('Erreur: Promotion non trouvée ou non valide');
      return res.status(404).json({ message: 'Promotion non trouvée ou non valide' });
    }

    const orderAmount = order.totalAmount;
    console.log('Montant de la commande:', orderAmount);
    if (orderAmount < promotion.minOrderAmount) {
      console.log('Erreur: Montant minimum non atteint');
      return res.status(400).json({ message: `Montant minimum de ${promotion.minOrderAmount} FCFA requis pour cette promotion` });
    }

    let discount = 0;
    if (promotion.discountType === 'percentage') {
      discount = (promotion.discountValue / 100) * orderAmount;
    } else {
      discount = promotion.discountValue;
    }
    if (discount > orderAmount) discount = orderAmount;
    console.log('Réduction calculée:', discount);

    order.totalAmount -= discount;
    promotion.currentUses += 1;
    await Promise.all([promotion.save(), order.save()]);
    console.log('Commande et promotion mises à jour:', { order, promotion });

    await sendNotification(order.clientId, `Promotion ${promoCode} appliquée avec succès ! Réduction de ${discount} FCFA`);
    console.log('Notification envoyée');

    res.status(200).json({ message: 'Promotion appliquée avec succès', order });
  } catch (error) {
    console.log('Erreur dans applyPromotion:', error.message);
    res.status(500).json({ message: 'Erreur lors de l\'application de la promotion', error: error.message });
  }
  console.log('--- Fin applyPromotion ---');
};

// Supprimer une promotion
exports.deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;

    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée' });
    }

    if (req.user.role !== 'admin' && promotion.supermarketId.toString() !== req.user.supermarketId) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    await Promotion.findByIdAndDelete(id);

    res.json({ message: 'Promotion supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression de la promotion', error: error.message });
  }
};

module.exports = exports;