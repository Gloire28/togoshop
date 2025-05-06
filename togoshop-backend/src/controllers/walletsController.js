const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const { sendNotification } = require('../services/notifications');
const { processExternalPayment } = require('../services/paymentGateway');

// Créditer le portefeuille (dépôt par le client via Flooz/TMoney)
exports.depositToWallet = async (req, res) => {
  try {
    const { amount, method, clientPhone } = req.body;

    // Vérifier les champs
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Montant positif requis' });
    }
    if (!method || !['Flooz', 'TMoney'].includes(method)) {
      return res.status(400).json({ message: 'Méthode de paiement non supportée. Utilisez Flooz ou TMoney' });
    }
    if (!clientPhone) {
      return res.status(400).json({ message: 'Numéro de téléphone requis pour Flooz/TMoney' });
    }

    // Trouver ou créer le portefeuille du client
    let wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      wallet = new Wallet({ userId: req.user.id, balance: 0, transactions: [] });
    }

    // Traiter le paiement externe via Flooz/TMoney
    const paymentResult = await processExternalPayment({ amount, method, clientPhone });
    if (!paymentResult.success) {
      return res.status(400).json({ message: paymentResult.message });
    }

    // Ajouter la transaction de dépôt
    wallet.transactions.push({
      type: 'deposit',
      amount,
      description: `Dépôt via ${method} (Transaction ID: ${paymentResult.transactionId})`,
      date: new Date(),
    });

    // Mettre à jour le solde
    wallet.balance += amount;
    await wallet.save();

    // Notifier le client
    await sendNotification(req.user.id, `Votre portefeuille a été crédité de ${amount} FCFA`);

    res.status(200).json({ message: 'Dépôt effectué avec succès', balance: wallet.balance });
  } catch (error) {
    console.error('Erreur lors du dépôt:', error.message);
    res.status(500).json({ message: 'Erreur lors du dépôt', error: error.message });
  }
};

// Consulter le solde et l’historique
exports.getWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      wallet = new Wallet({ userId: req.user.id, balance: 0, transactions: [] });
      await wallet.save();
    }
    res.status(200).json(wallet);
  } catch (error) {
    console.error('Erreur lors de la récupération du portefeuille:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération du portefeuille', error: error.message });
  }
};

// Créditer un portefeuille pour une remise ou compensation
exports.creditWallet = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;

    // Vérifier les autorisations (admin ou validateur)
    if (req.user.role !== 'admin' && req.user.role !== 'order_validator') {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au validateur' });
    }

    // Vérifier les champs
    if (!userId || !amount || amount <= 0 || !description) {
      return res.status(400).json({ message: 'User ID, montant positif et description requis' });
    }

    // Trouver ou créer le portefeuille du client
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] });
    }

    // Ajouter la transaction de crédit
    wallet.transactions.push({
      type: 'credit',
      amount,
      description,
      date: new Date(),
    });

    // Mettre à jour le solde
    wallet.balance += amount;
    await wallet.save();

    // Notifier le client
    await sendNotification(userId, `Votre portefeuille a été crédité de ${amount} FCFA : ${description}`);

    res.status(200).json({ message: 'Portefeuille crédité avec succès', balance: wallet.balance });
  } catch (error) {
    console.error('Erreur lors du crédit:', error.message);
    res.status(500).json({ message: 'Erreur lors du crédit', error: error.message });
  }
};