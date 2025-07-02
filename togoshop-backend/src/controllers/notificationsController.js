const Notification = require('../models/Notification');
const { sendNotification } = require('../services/notifications');
const Product = require('../models/Product');
const Order = require('../models/Order');

// S'abonner aux notifications
exports.subscribeToNotification = async (req, res) => {
  try {
    const { type, entityId } = req.body;
    
    if (!type || !entityId) {
      return res.status(400).json({ message: 'Type et ID de l\'entité requis' });
    }

    let entityModel;
    let title = 'Notification';
    let message = 'Vous êtes maintenant abonné à cette notification';

    switch(type) {
      case 'restock':
        entityModel = 'Product';
        const product = await Product.findById(entityId);
        if (!product) {
          return res.status(404).json({ message: 'Produit non trouvé' });
        }
        title = 'Réapprovisionnement';
        message = `Vous serez notifié quand ${product.name} sera réapprovisionné`;
        break;
      
      case 'promotion':
        entityModel = 'Promotion';
        title = 'Promotions';
        message = 'Vous serez notifié des nouvelles promotions';
        break;
      
      case 'order_update':
        entityModel = 'Order';
        const order = await Order.findById(entityId);
        if (!order || order.clientId.toString() !== req.user.id) {
          return res.status(404).json({ message: 'Commande non trouvée' });
        }
        title = 'Suivi de commande';
        message = `Vous serez notifié des mises à jour de la commande #${order._id.toString().substr(18)}`;
        break;
      
      default:
        return res.status(400).json({ message: 'Type de notification non supporté' });
    }

    const notification = new Notification({
      userId: req.user.id,
      type,
      title,
      message,
      relatedEntity: entityId,
      entityModel,
      metadata: { subscription: true }
    });

    await notification.save();

    // Envoyer une notification push immédiate
    await sendNotification(req.user.id, `${title}: ${message}`);

    res.status(201).json({
      message: 'Abonnement réussi',
      notification
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de l’inscription', 
      error: error.message 
    });
  }
};

// Créer une notification personnalisée
exports.createNotification = async (req, res) => {
  try {
    const { userId, type, title, message, entityId, entityModel, metadata } = req.body;
    
    if (!type || !title || !message) {
      return res.status(400).json({ message: 'Type, titre et message requis' });
    }

    const notification = new Notification({
      userId,
      type,
      title,
      message,
      relatedEntity: entityId,
      entityModel,
      metadata
    });

    await notification.save();

    // Envoyer une notification push
    await sendNotification(userId, `${title}: ${message}`);

    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de la création', 
      error: error.message 
    });
  }
};

// Récupérer les notifications de l'utilisateur
exports.getNotifications = async (req, res) => {
  try {
    const { type, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = { userId: req.user.id };
    if (type) filter.type = type;
    
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('relatedEntity');
    
    const total = await Notification.countDocuments(filter);
    
    res.status(200).json({
      notifications,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de la récupération', 
      error: error.message 
    });
  }
};

// Marquer une notification comme lue
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: { isRead: true } },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }
    
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour', 
      error: error.message 
    });
  }
};

// Supprimer une notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.user.id
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }
    
    res.status(200).json({ message: 'Notification supprimée' });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de la suppression', 
      error: error.message 
    });
  }
};

// Service interne pour déclencher des notifications
exports.triggerNotification = async (type, data) => {
  try {
    let notifications = [];
    
    switch(type) {
      case 'restock':
        const product = await Product.findById(data.productId);
        if (!product) return;
        
        // Trouver les utilisateurs abonnés
        const subscribers = await Notification.find({
          type: 'restock',
          'relatedEntity': data.productId
        });
        
        for (const sub of subscribers) {
          const notification = new Notification({
            userId: sub.userId,
            type: 'restock',
            title: 'Réapprovisionnement',
            message: `${product.name} est maintenant disponible!`,
            relatedEntity: data.productId,
            entityModel: 'Product'
          });
          
          await notification.save();
          await sendNotification(sub.userId, `Réapprovisionnement: ${product.name} est disponible!`);
          notifications.push(notification);
        }
        break;
        
      case 'order_update':
        const order = await Order.findById(data.orderId).populate('clientId');
        if (!order) return;
        
        const notification = new Notification({
          userId: order.clientId,
          type: 'order_update',
          title: 'Mise à jour de commande',
          message: `Votre commande #${order._id.toString().substr(18)} est maintenant ${data.status}`,
          relatedEntity: data.orderId,
          entityModel: 'Order',
          metadata: { status: data.status }
        });
        
        await notification.save();
        await sendNotification(
          order.clientId, 
          `Commande #${order._id.toString().substr(18)}: ${data.status}`
        );
        notifications.push(notification);
        break;
        
      // Ajouter d'autres types ici..
    }
    
    return notifications;
  } catch (error) {
    console.error('Erreur dans triggerNotification:', error);
    return [];
  }
};