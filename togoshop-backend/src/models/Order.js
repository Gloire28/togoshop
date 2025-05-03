const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  products: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: false,
    },
    quantity: {
      type: Number,
      required: false,
      min: 1,
    },
    alternativeLocationId: { 
      type: String },
  }],
  supermarketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supermarket',
    required: true,
  },
  locationId: {
    type: String,
    required: true,
  },
  deliveryAddress: {
    address: {
      type: String,
      required: true,
    },
    lat: {
      type: Number,
      required: false,
      default: 6.1725, // Lomé par défaut
    },
    lng: {
      type: Number,
      required: false,
      default: 1.2314,
    },
  },
  scheduledDeliveryTime: {
    type: Date,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  deliveryFee: {
    type: Number,
    required: true,
  },
  additionalFees: { 
    type: Number, 
    default: 0 
  },
  
  status: {
    type: String,
    enum: ['pending_validation', 'awaiting_validator', 'validated', 'in_delivery', 'delivered', 'cancelled'],
    default: 'pending_validation',
  },
  validatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manager',
    required: false,
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', orderSchema);