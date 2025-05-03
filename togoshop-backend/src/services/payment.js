const axios = require('axios');
const Payment = require('../models/Payment');
const { sendNotification } = require('./notifications');

// Liste des méthodes de paiement supportées
const SUPPORTED_METHODS = ['Flooz', 'TMoney', 'wallet'];

// Configuration des API externes (à remplacer par les vraies clés après inscription)
const FLOOZ_API_URL = 'https://api.flooz.moov.tg/v1'; // URL hypothétique, à remplacer
const FLOOZ_API_KEY = 'FLOOZ_API_KEY'; // À obtenir via Moov
const TMONEY_API_URL = 'https://api.tmoney.togocom.tg/v1'; // URL hypothétique, à remplacer
const TMONEY_API_KEY = 'TMONEY_API_KEY'; // À obtenir via Togocom/Mixx by Yas

// Valider un paiement via une API externe
exports.processExternalPayment = async (paymentId, method, amount, clientPhone) => {
  try {
    if (!SUPPORTED_METHODS.includes(method)) {
      throw new Error(`Méthode de paiement non supportée : ${method}`);
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error('Paiement non trouvé');
    }

    if (method === 'wallet') {
      return { success: true, message: 'Paiement via portefeuille géré localement' };
    }

    let apiUrl, apiKey, payload;

    if (method === 'Flooz') {
      apiUrl = `${FLOOZ_API_URL}/transactions`;
      apiKey = FLOOZ_API_KEY;
      payload = {
        amount,
        phone: clientPhone,
        description: `Paiement TogoShop - Commande ${payment.orderId}`,
      };
    } else if (method === 'TMoney') {
      apiUrl = `${TMONEY_API_URL}/transactions`;
      apiKey = TMONEY_API_KEY;
      payload = {
        amount,
        phone: clientPhone,
        reference: `TGSHP-${payment.orderId}`,
      };
    }

    // Simulation d’un appel API (à remplacer par un vrai appel une fois les API intégrées)
    const response = await axios.post(apiUrl, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.data.success) {
      payment.status = 'completed';
      payment.centralAccountBalance += amount;
      await payment.save();

      await sendNotification(payment.clientId, `Paiement de ${amount} FCFA via ${method} réussi`);
      return { success: true, message: 'Paiement validé avec succès' };
    } else {
      payment.status = 'failed';
      await payment.save();
      throw new Error('Échec du paiement via ' + method);
    }
  } catch (error) {
    throw new Error(`Erreur lors du traitement du paiement : ${error.message}`);
  }
};