const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Wallet = require('../models/Wallet');
const { sendNotification } = require('../services/notifications');

// Méthodes de paiement autorisées
const ALLOWED_PAYMENT_METHODS = ['Flooz', 'TMoney', 'wallet', 'cash'];

// Simuler un paiement externe (à remplacer par une vraie API)
const processExternalPayment = async (method, amount, clientPhone) => {
  return { success: true, message: `Paiement simulé avec ${method} pour ${amount} FCFA` };
};

exports.createPayment = async (orderId, method, clientPhone, user) => {
  try {
    // Ajouter des logs pour déboguer
    console.log('createPayment - Début');
    console.log('createPayment - orderId:', orderId);
    console.log('createPayment - method:', method);
    console.log('createPayment - clientPhone:', clientPhone);
    console.log('createPayment - user:', JSON.stringify(user));

    // Vérifier les champs
    if (!orderId || !method) {
      throw new Error('ID de la commande et méthode de paiement requis');
    }

    if (method !== 'cash' && !clientPhone && method !== 'wallet') {
      throw new Error('Numéro de téléphone requis pour les paiements Flooz/TMoney');
    }

    // Valider la méthode de paiement
    if (!ALLOWED_PAYMENT_METHODS.includes(method)) {
      throw new Error(`Méthode de paiement non supportée. Méthodes autorisées : ${ALLOWED_PAYMENT_METHODS.join(', ')}`);
    }

    // Trouver la commande
    const order = await Order.findById(orderId).populate('clientId');
    if (!order) {
      throw new Error('Commande non trouvée');
    }

    // Déboguer la valeur de clientId après populate
    console.log('createPayment - order.clientId (après populate):', order.clientId);
    console.log('createPayment - order.clientId type:', typeof order.clientId);

    // Vérifier que l’utilisateur est le client de la commande
    let clientIdToCompare;
    if (typeof order.clientId === 'object' && order.clientId._id) {
      // Si clientId est populé, c'est un objet avec un champ _id
      clientIdToCompare = order.clientId._id.toString();
    } else {
      // Sinon, c'est un ObjectId brut
      clientIdToCompare = order.clientId.toString();
    }

    console.log('createPayment - clientIdToCompare:', clientIdToCompare);
    console.log('createPayment - user.id:', user.id);

    if (user.role !== 'admin' && clientIdToCompare !== user.id.toString()) {
      console.log('Accès refusé - Comparaison:', clientIdToCompare, 'vs', user.id.toString());
      throw new Error('Accès non autorisé');
    }

    // Vérifier que la commande n’a pas déjà un paiement terminé
    const existingPayment = await Payment.findOne({ orderId });
    if (existingPayment && existingPayment.status === 'completed') {
      throw new Error('Cette commande a déjà été payée');
    }

    // Utiliser le totalAmount calculé dans l'ordre
    const amount = order.totalAmount;
    console.log('createPayment - amount:', amount);

    // Créer le paiement
    const payment = new Payment({
      orderId,
      clientId: order.clientId._id || order.clientId, // S'assurer de stocker l'ObjectId brut
      amount,
      method,
      status: 'pending',
      transactionId: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      clientPhone: method !== 'cash' && method !== 'wallet' ? clientPhone : undefined,
    });
    await payment.save();
    console.log('Paiement sauvegardé avec succès dans createPayment, _id:', payment._id);

    // Gestion du paiement selon la méthode
    if (method === 'wallet') {
      // Vérifier et déduire du portefeuille
      let wallet = await Wallet.findOne({ clientId: order.clientId._id || order.clientId });
      if (!wallet) {
        wallet = new Wallet({ clientId: order.clientId._id || order.clientId, balance: 0 });
      }

      if (wallet.balance < amount) {
        throw new Error('Solde insuffisant dans le portefeuille');
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

      await sendNotification(order.clientId._id || order.clientId, 'Votre paiement a été effectué avec succès');
    } else if (method === 'cash') {
      payment.status = 'completed';
      await payment.save();
      await sendNotification(order.clientId._id || order.clientId, 'Paiement en espèces enregistré avec succès');
    } else {
      // Paiement externe (Flooz/TMoney)
      const result = await processExternalPayment(method, amount, clientPhone);
      if (!result.success) {
        throw new Error(result.message);
      }
      payment.status = 'pending'; // À confirmer via callback API
      await payment.save();
    }

    return { paymentId: payment._id, status: payment.status };
  } catch (error) {
    console.error('Erreur lors de la création du paiement dans createPayment:', error.message);
    throw error;
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

    const payment = await Payment.findById(paymentId).populate('orderId');
    if (!payment) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ message: 'Ce paiement n’est pas terminé' });
    }

    // Rembourser via le portefeuille
    let wallet = await Wallet.findOne({ clientId: payment.clientId });
    if (!wallet) {
      wallet = new Wallet({ clientId: payment.clientId, balance: 0 });
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