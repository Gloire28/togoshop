const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['restock', 'promotion', 'order_update', 'payment', 'loyalty', 'system'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedEntity: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'entityModel'
  },
  entityModel: {
    type: String,
    enum: ['Product', 'Order', 'Promotion', 'Payment', 'Loyalty']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

notificationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index composé pour les requêtes fréquentes
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);