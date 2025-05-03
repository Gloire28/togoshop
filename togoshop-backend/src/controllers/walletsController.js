const mongoose = require('mongoose');
const { sendNotification } = require('../services/notifications');

// Schéma temporaire pour le portefeuille (à ajouter dans models/Wallet.js plus tard)
const walletSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  balance: { type: Number, default: 0 },
  transactions: [
    {
      type: { type: String, enum: ['deposit', 'payment', 'credit', 'refund'], required: true },
      amount: { type: Number, required: true },
      description: { type: String, required: true },
      date: { type: Date, default: Date.now },
    },
  ],
});

const Wallet = require('../models/Wallet');

// Créditer le portefeuille (dépôt par le client)
exports.depositToWallet = async (req, res) => {
  try {
    const { amount, method } = req.body;

    // Vérifier les champs
    if (!amount || amount <= 0 || !method) {
      return res.status(400).json({ message: 'Montant positif et méthode de paiement requis' });
    }

    // Trouver ou créer le portefeuille du client
    let wallet = await Wallet.findOne({ clientId: req.user.id });
    if (!wallet) {
      wallet = new Wallet({ clientId: req.user.id });
    }

    // Ajouter la transaction de dépôt
    wallet.transactions.push({
      type: 'deposit',
      amount,
      description: `Dépôt via ${method}`,
    });

    // Mettre à jour le solde
    wallet.balance += amount;
    await wallet.save();

    // Notifier le client
    await sendNotification(req.user.id, `Votre portefeuille a été crédité de ${amount} FCFA`);

    res.status(200).json({ message: 'Dépôt effectué avec succès', balance: wallet.balance });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du dépôt', error: error.message });
  }
};

// Consulter le solde et l’historique
exports.getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ clientId: req.user.id });
    if (!wallet) {
      return res.status(404).json({ message: 'Portefeuille non trouvé', balance: 0, transactions: [] });
    }

    res.status(200).json(wallet);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du portefeuille', error: error.message });
  }
};

// Créditer un portefeuille pour une remise ou compensation
exports.creditWallet = async (req, res) => {
  try {
    const { clientId, amount, description } = req.body;

    // Vérifier les autorisations (admin ou validateur)
    if (req.user.role !== 'admin' && req.user.role !== 'order_validator') {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au validateur' });
    }

    // Vérifier les champs
    if (!clientId || !amount || amount <= 0 || !description) {
      return res.status(400).json({ message: 'Client ID, montant positif et description requis' });
    }

    // Trouver ou créer le portefeuille du client
    let wallet = await Wallet.findOne({ clientId });
    if (!wallet) {
      wallet = new Wallet({ clientId });
    }

    // Ajouter la transaction de crédit
    wallet.transactions.push({
      type: 'credit',
      amount,
      description,
    });

    // Mettre à jour le solde
    wallet.balance += amount;
    await wallet.save();

    // Notifier le client
    await sendNotification(clientId, `Votre portefeuille a été crédité de ${amount} FCFA : ${description}`);

    res.status(200).json({ message: 'Portefeuille crédité avec succès', balance: wallet.balance });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du crédit', error: error.message });
  }
};