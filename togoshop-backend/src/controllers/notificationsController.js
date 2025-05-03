const Notification = require('../models/Notification');

exports.subscribeToRestock = async (req, res) => {
  try {
    const { productId, locationId } = req.body;

    const notification = new Notification({
      userId: req.user.id,
      productId,
      locationId,
    });

    await notification.save();

    res.status(201).json({
      message: 'Inscription à la notification de réapprovisionnement réussie',
      notification,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l’inscription', error: error.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des notifications', error: error.message });
  }
};