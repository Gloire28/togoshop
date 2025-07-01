const mongoose = require('mongoose');

const supermarketSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  subscriptionPlan: {
    type: String,
    enum: ['monthly', 'annual'],
    required: true,
    default: 'monthly',
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'inactive',
  },
  locations: [{
    _id: { type: String, required: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  }],
  managers: [{
    managerId: {
      type: String,
      required: true,
    },
    locationId: {
      type: String,
      required: true,
    },
    role: {
      type: [String], 
      enum: ['order_validator', 'stock_manager', 'manager'],
      required: true,
    },
  }],
  branding: {
    logoUrl: String,
    primaryColor: String,
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'maintenance'],
    default: 'open',
    required: true,
  },
  isOpen: { 
    type: Boolean,
    default: true,
  },
  closureReason: {
    type: String,
    default: null,
  },
  scheduledClosure: {
    type: {
      start: { type: Date, default: null },
      end: { type: Date, default: null },
    },
    default: { start: null, end: null },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { collection: 'supermarkets' });

supermarketSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // Synchroniser isOpen avec status : true uniquement si status est 'open'
  this.isOpen = this.status === 'open';
  if (this.scheduledClosure.start && this.scheduledClosure.end && this.scheduledClosure.start > this.scheduledClosure.end) {
    const err = new Error('La date de début de fermeture doit être antérieure à la date de fin.');
    return next(err);
  }
  next();
});

module.exports = mongoose.model('Supermarket', supermarketSchema);