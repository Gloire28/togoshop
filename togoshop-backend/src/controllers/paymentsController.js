const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Wallet = require('../models/Wallet');
const { processExternalPayment } = require('../services/paymentGateway');
const { sendNotification } = require('../services/notifications');

// Méthodes de paiement autorisées
const ALLOWED_PAYMENT_METHODS = ['Flooz', 'TMoney', 'wallet'];

// Créer un nouveau paiement
exports.createPayment = async (req, res) => {
  try {
    const { orderId, method, clientPhone } = req.body;

    // Vérifier les champs
    if (!orderId || !method) {
      return res.status(400).json({ message: 'ID de la commande et méthode de paiement requis' });
    }

    if (method !== 'wallet' && !clientPhone) {
      return res.status(400).json({ message: 'Numéro de téléphone requis pour les paiements Flooz/TMoney' });
    }

    // Valider la méthode de paiement
    if (!ALLOWED_PAYMENT_METHODS.includes(method)) {
      return res.status(400).json({ message: `Méthode de paiement non supportée. Méthodes autorisées : ${ALLOWED_PAYMENT_METHODS.join(', ')}` });
    }

    // Trouver la commande
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    // Vérifier que l’utilisateur est le client de la commande
    if (req.user.role !== 'admin' && order.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Vérifier que la commande n’a pas déjà un paiement terminé
    const existingPayment = await Payment.findOne({ orderId });
    if (existingPayment && existingPayment.status === 'completed') {
      return res.status(400).json({ message: 'Cette commande a déjà été payée' });
    }

    // Calculer le montant
    const amount = order.totalAmount + order.deliveryFee;

    // Créer le paiement
    const payment = new Payment({
      orderId,
      clientId: order.clientId,
      amount,
      method,
      status: 'pending',
      transactionId: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });
    try {
      await payment.save();
      console.log('Paiement sauvegardé avec succès dans createPayment, _id:', payment._id);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du paiement dans createPayment:', error.message);
      throw error;
    }

    // Gestion du paiement selon la méthode
    if (method === 'wallet') {
      // Vérifier et déduire du portefeuille
      let wallet = await Wallet.findOne({ clientId: req.user.id });
      if (!wallet) {
        return res.status(400).json({ message: 'Portefeuille non trouvé. Veuillez d’abord effectuer un dépôt.' });
      }

      if (wallet.balance < amount) {
        return res.status(400).json({ message: 'Solde insuffisant dans le portefeuille' });
      }

      wallet.balance -= amount;
      wallet.transactions.push({
        type: 'payment',
        amount: -amount,
        description: `Paiement de la commande ${orderId}`,
      });
      await wallet.save();

      payment.status = 'completed';
      await payment.save();

      await sendNotification(order.clientId, 'Votre paiement a été effectué avec succès');
    } else {
      // Utiliser le service pour les paiements externes
      const result = { success: true, message: 'Paiement simulé avec succès' };
      console.log('Paiement simulé pour orderId:', payment.orderId);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
    }

    res.status(201).json({ message: 'Paiement créé avec succès', payment });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du paiement', error: error.message });
  }
};

// Récupérer les détails d’un paiement
exports.getPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id).populate('orderId');
    if (!payment) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    // Vérifier les autorisations (client du paiement ou admin)
    if (req.user.role !== 'admin' && payment.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du paiement', error: error.message });
  }
};

// Rembourser un paiement (en cas d’annulation de commande)
exports.refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;

    // Vérifier les autorisations (admin ou validateur)
    if (req.user.role !== 'admin' && req.user.role !== 'order_validator') {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au validateur' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ message: 'Ce paiement n’est pas terminé' });
    }

    // Rembourser via le portefeuille
    let wallet = await Wallet.findOne({ clientId: payment.clientId });
    if (!wallet) {
      wallet = new Wallet({ clientId: payment.clientId });
    }

    wallet.balance += payment.amount;
    wallet.transactions.push({
      type: 'refund',
      amount: payment.amount,
      description: `Remboursement du paiement ${paymentId}`,
    });
    await wallet.save();

    // Mettre à jour le paiement
    payment.status = 'refunded';
    if (payment.method !== 'wallet') {
      payment.centralAccountBalance -= payment.amount; // Retirer de la caisse commune
    }
    await payment.save();

    // Notifier le client
    await sendNotification(payment.clientId, `Votre paiement de ${payment.amount} FCFA a été remboursé`);

    res.status(200).json({ message: 'Paiement remboursé avec succès', payment });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du remboursement', error: error.message });
  }
};