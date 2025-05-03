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
      type: String,
      enum: ['order_validator', 'stock_manager'],
      required: true,
    },
  }],
  branding: {
    logoUrl: String,
    primaryColor: String,
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
  next();
});

module.exports = mongoose.model('Supermarket', supermarketSchema);