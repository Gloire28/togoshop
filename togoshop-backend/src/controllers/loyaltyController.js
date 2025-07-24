const mongoose = require('mongoose');
const Loyalty = require('../models/loyalty');
const Order = require('../models/Order');
const { roundToTwoDecimals } = require('../services/numberUtils');
const { sendNotification } = require('../services/notifications');

// Consulter les points de fidélité de l'utilisateur connecté
exports.getUserLoyalty = async (req, res) => 
  {
  try {
    let loyalty = await Loyalty.findOne({ userId: req.user.id })
      .select('points transactions')
      .lean();

    if (!loyalty) {
      loyalty = new Loyalty({ userId: req.user.id, points: 0, transactions: [] });
      await loyalty.save();
      loyalty = { points: 0, transactions: [] };
    }

    res.status(200).json(loyalty);
  } catch (error) {
    console.error('Erreur lors de la récupération des points de fidélité:', error.message);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des points', error: error.message });
  }
};

// Ajouter des points (par exemple, après une commande ou manuellement par un admin)
exports.addPoints = async (req, res) => {
  try {
    const { points, description, userId, fromOrder } = req.body;

    if (req.user.role !== 'admin' && !fromOrder) {
      return res.status(403).json({ message: 'Accès réservé à un administrateur ou à une commande' });
    }

    if (!points || points <= 0 || !description) {
      return res.status(400).json({ message: 'Points positifs et description requis' });
    }

    const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.id;

    let loyalty = await Loyalty.findOne({ userId: targetUserId });
    if (!loyalty) {
      loyalty = new Loyalty({ userId: targetUserId, points: 0, transactions: [] });
    }

    loyalty.transactions.push({
      type: 'earned',
      amount: points,
      description,
      date: new Date(),
    });
    loyalty.points += points;
    await loyalty.save();

    await sendNotification(targetUserId, `Vous avez gagné ${points} points de fidélité !`);

    const response = {
      points: loyalty.points,
      transactions: loyalty.transactions,
    };
    res.status(200).json({ message: 'Points ajoutés avec succès', loyalty: response });
  } catch (error) {
    console.error('Erreur lors de l’ajout des points:', error.message);
    res.status(500).json({ message: 'Erreur serveur lors de l’ajout des points', error: error.message });
  }
};

// Utiliser des points pour une réduction sur une commande spécifique
exports.redeemPoints = async (req, res) => {
  const { refundPoints } = require('./loyaltyController');
  try {
    const { points, orderId } = req.body;
    const POINTS_TO_VALUE_RATE = 50; // 1 point = 50 unités monétaires

    // Vérifier les champs
    if (!points || points <= 0 || !Number.isInteger(points)) {
      console.log(`Points invalides: ${points}`);
      return res.status(400).json({ message: 'Points positifs entiers requis' });
    }
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      console.log(`orderId invalide: ${orderId}`);
      return res.status(400).json({ message: 'orderId valide requis pour utiliser les points' });
    }

    // Trouver le profil de fidélité
    let loyalty = await Loyalty.findOne({ userId: req.user.id });
    if (!loyalty) {
      console.log(`Profil de fidélité non trouvé pour l'utilisateur ${req.user.id}`);
      return res.status(404).json({ message: 'Profil de fidélité non trouvé' });
    }

    // Vérifier si l'utilisateur a assez de points
    if (loyalty.points < points) {
      console.log(`Points insuffisants: ${loyalty.points} disponibles, ${points} requis`);
      return res.status(400).json({ message: 'Points insuffisants' });
    }

    // Trouver la commande
    const order = await Order.findById(orderId);
    if (!order) {
      console.log(`Commande non trouvée pour _id ${orderId}`);
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    // Vérifier que la commande appartient à l'utilisateur
    if (order.clientId.toString() !== req.user.id) {
      console.log(`Utilisateur ${req.user.id} non autorisé pour la commande ${orderId}`);
      return res.status(403).json({ message: 'Non autorisé à modifier cette commande' });
    }

    // Vérifier que la commande est dans un état valide
    if (order.status !== 'cart_in_progress') {
      console.log(`Commande ${orderId} non modifiable, statut actuel: ${order.status}`);
      return res.status(400).json({ message: 'Les points ne peuvent être utilisés que sur une commande en cart_in_progress' });
    }

    // Rembourser les points précédemment utilisés
    if (order.loyaltyPointsUsed > 0) {
      try {
        const refundResponse = await new Promise((resolve, reject) => {
          refundPoints(
            {
              user: req.user,
              body: { orderId },
            },
            {
              status: (code) => ({
                json: (data) => (code >= 400 ? reject(data) : resolve(data)),
              }),
            }
          );
        });
        console.log(`Points précédemment utilisés remboursés pour la commande ${orderId}:`, refundResponse);
      } catch (error) {
        console.error(`Erreur lors du remboursement des points pour la commande ${orderId}:`, error.message);
        return res.status(500).json({ message: 'Erreur lors du remboursement des points précédents', error: error.message });
      }
    }

    // Calculer la réduction
    const reductionAmount = points * POINTS_TO_VALUE_RATE;

    // Vérifier que totalAmount ne devient pas négatif
    const preliminaryTotal = order.subtotal + order.deliveryFee + (order.serviceFee || 0) + (order.additionalFees || 0) - reductionAmount;
    if (preliminaryTotal < 0) {
      console.log(`Réduction ${reductionAmount} rendrait totalAmount négatif: ${preliminaryTotal}`);
      return res.status(400).json({ message: 'La réduction des points ne peut pas rendre le montant total négatif' });
    }

    // Mettre à jour la commande
    order.loyaltyPointsUsed = points;
    order.loyaltyReductionAmount = reductionAmount;
    order.totalAmount = roundToTwoDecimals(preliminaryTotal);
    await order.save();

    // Créer la description de la transaction
    const transactionDescription = `Utilisation de ${points} points pour une réduction de ${reductionAmount} FCFA sur la commande ${orderId}`;

    // Ajouter la transaction et mettre à jour les points
    loyalty.transactions.push({
      type: 'redeemed',
      amount: points,
      description: transactionDescription,
      orderId,
      date: new Date(),
    });
    loyalty.points -= points;
    await loyalty.save();

    // Log des modifications
    console.log(`Points utilisés pour la commande ${orderId}:`, {
      loyaltyPointsUsed: order.loyaltyPointsUsed,
      loyaltyReductionAmount: order.loyaltyReductionAmount,
      totalAmount: order.totalAmount,
      remainingPoints: loyalty.points,
    });

    // Notifier l'utilisateur
    await sendNotification(req.user.id, `Vous avez utilisé ${points} points pour une réduction de ${reductionAmount} FCFA sur la commande ${orderId} !`);

    // Retourner les champs nécessaires, y compris la réduction
    const response = {
      points: loyalty.points,
      transactions: loyalty.transactions,
      reductionAmount,
    };
    res.status(200).json({ message: 'Points utilisés avec succès', loyalty: response });
  } catch (error) {
    console.error('Erreur lors de l’utilisation des points:', error.message);
    res.status(500).json({ message: 'Erreur serveur lors de l’utilisation des points', error: error.message });
  }
};

// Rembourser les points utilisés pour une commande annulée
exports.refundPoints = async (req, res) => {
  try {
    const { orderId } = req.body;

    // Vérifier les champs
    if (!orderId) {
      return res.status(400).json({ message: 'orderId requis pour rembourser les points' });
    }

    // Trouver la commande
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    // Vérifier que la commande appartient à l'utilisateur
    if (order.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Non autorisé à rembourser les points pour cette commande' });
    }

    // Vérifier que la commande est dans un état annulable
    if (order.status !== 'cart_in_progress' && order.status !== 'pending_validation') {
      return res.status(400).json({ message: 'Impossible de rembourser les points pour une commande non annulable' });
    }

    // Trouver le profil de fidélité
    let loyalty = await Loyalty.findOne({ userId: req.user.id });
    if (!loyalty) {
      return res.status(404).json({ message: 'Profil de fidélité non trouvé' });
    }

    // Trouver la transaction associée à l'orderId
    const redeemedTransaction = loyalty.transactions.find(
      (t) => t.type === 'redeemed' && t.orderId && t.orderId.toString() === orderId
    );
    if (!redeemedTransaction) {
      return res.status(404).json({ message: 'Aucune transaction de points trouvée pour cette commande' });
    }

    // Restaurer les points
    const pointsToRefund = redeemedTransaction.amount;
    loyalty.points += pointsToRefund;

    // Ajouter une transaction de remboursement
    loyalty.transactions.push({
      type: 'refunded',
      amount: pointsToRefund,
      description: `Remboursement de ${pointsToRefund} points pour l'annulation de la commande ${orderId}`,
      orderId,
      date: new Date(),
    });

    // Mettre à jour la commande pour réinitialiser les champs de fidélité
    order.loyaltyPointsUsed = 0;
    order.loyaltyReductionAmount = 0;
    order.totalAmount = order.subtotal + order.deliveryFee + order.serviceFee;
    await order.save();

    // Sauvegarder le profil de fidélité
    await loyalty.save();

    // Notifier l'utilisateur
    await sendNotification(req.user.id, `Vous avez été remboursé de ${pointsToRefund} points suite à l'annulation de la commande ${orderId} !`);

    // Retourner les champs nécessaires
    const response = {
      points: loyalty.points,
      transactions: loyalty.transactions,
    };
    res.status(200).json({ message: 'Points remboursés avec succès', loyalty: response });
  } catch (error) {
    console.error('Erreur lors du remboursement des points:', error.message);
    res.status(500).json({ message: 'Erreur serveur lors du remboursement des points', error: error.message });
  }
};