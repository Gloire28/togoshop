const Loyalty = require('../models/loyalty');
const { sendNotification } = require('../services/notifications');

// Consulter les points de fidélité de l'utilisateur connecté
exports.getUserLoyalty = async (req, res) => {
  try {
    let loyalty = await Loyalty.findOne({ userId: req.user.id })
      .select('points transactions') // Sélectionner uniquement les champs nécessaires
      .lean(); // Utiliser .lean() pour des performances accrues

    if (!loyalty) {
      loyalty = new Loyalty({ userId: req.user.id, points: 0, transactions: [] });
      await loyalty.save();
      loyalty = { points: 0, transactions: [] }; // Retourner un objet simplifié
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

    // Vérifier les autorisations
    if (req.user.role !== 'admin' && !fromOrder) {
      return res.status(403).json({ message: 'Accès réservé à un administrateur ou à une commande' });
    }

    // Vérifier les champs
    if (!points || points <= 0 || !description) {
      return res.status(400).json({ message: 'Points positifs et description requis' });
    }

    // Déterminer l'userId cible
    const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.id;

    // Trouver ou créer le profil de fidélité
    let loyalty = await Loyalty.findOne({ userId: targetUserId });
    if (!loyalty) {
      loyalty = new Loyalty({ userId: targetUserId, points: 0, transactions: [] });
    }

    // Ajouter la transaction et mettre à jour les points
    loyalty.transactions.push({
      type: 'earned',
      amount: points,
      description,
      date: new Date(),
    });
    loyalty.points += points;
    await loyalty.save();

    // Notifier l'utilisateur
    await sendNotification(targetUserId, `Vous avez gagné ${points} points de fidélité !`);

    // Retourner uniquement les champs nécessaires
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

// Utiliser des points pour une réduction ou récompense
exports.redeemPoints = async (req, res) => {
  try {
    const { points, description } = req.body;

    // Vérifier les champs
    if (!points || points <= 0 || !description) {
      return res.status(400).json({ message: 'Points positifs et description requis' });
    }

    // Trouver le profil de fidélité
    let loyalty = await Loyalty.findOne({ userId: req.user.id });
    if (!loyalty) {
      return res.status(404).json({ message: 'Profil de fidélité non trouvé' });
    }

    // Vérifier si l'utilisateur a assez de points
    if (loyalty.points < points) {
      return res.status(400).json({ message: 'Points insuffisants' });
    }

    // Ajouter la transaction et mettre à jour les points
    loyalty.transactions.push({
      type: 'redeemed',
      amount: points,
      description,
      date: new Date(),
    });
    loyalty.points -= points;
    await loyalty.save();

    // Notifier l'utilisateur
    await sendNotification(req.user.id, `Vous avez utilisé ${points} points de fidélité !`);

    // Retourner uniquement les champs nécessaires
    const response = {
      points: loyalty.points,
      transactions: loyalty.transactions,
    };
    res.status(200).json({ message: 'Points utilisés avec succès', loyalty: response });
  } catch (error) {
    console.error('Erreur lors de l’utilisation des points:', error.message);
    res.status(500).json({ message: 'Erreur serveur lors de l’utilisation des points', error: error.message });
  }
};