const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  alternativeLocationId: {
    type: String,
    default: '',
  },
  comment: {
    type: String,
    default: '',
    trim: true,
    maxlength: [100, 'Le commentaire ne peut pas dépasser 100 caractères'],
  },
  photoUrl: {
    type: String,
    default: '',
  },
  promotedPrice: {
    type: Number,
    default: null,
  },
});

const orderSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  supermarketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supermarket',
    required: false, 
  },
  locationId: {
    type: String,
    required: function() {
      return this.products && this.products.length > 0;
    },
  },
  products: [productSchema],
  deliveryAddress: {
    address: {
      type: String,
      required: false,
      default: '',
    },
    lat: {
      type: Number,
      required: false,
      default: 6.1725,
    },
    lng: {
      type: Number,
      required: false,
      default: 1.2314,
    },
    instructions: {
      type: String,
      required: false,
      default: '',
      trim: true,
    },
  },
  scheduledDeliveryTime: {
    type: Date,
    required: false,
  },
  deliveryType: {
    type: String,
    enum: ['standard', 'evening', 'retrait'],
    default: 'standard',
  },
  comments: {
    type: String,
    default: '',
    trim: true,
  },
  subtotal: { 
    type: Number,
    default: 0,
  },
  deliveryFee: {
    type: Number,
    required: true,
  },
  additionalFees: {
    type: Number,
    default: 0,
  },
  serviceFee: { 
    type: Number,
    default: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  queuePosition: {
    type: Number,
    default: 0,
  },
  assignedManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manager',
    required: false,
  },
  status: {
    type: String,
    enum: [
      'cart_in_progress',
      'pending_validation',
      'awaiting_validator',
      'validated',
      'ready_for_pickup', 
      'in_delivery',
      'delivered',
      'cancelled',
      'delivery_issue', 
    ],
    default: 'cart_in_progress',
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
  priority: {
    type: Number,
    default: 2,
    enum: [1, 2],
  },
  zoneId: {
    type: String,
    default: '',
  },
  clientValidation: {
    type: Boolean,
    default: false,
  },
  paymentMethod: {
    type: String,
    enum: ['Flooz', 'TMoney', 'cash', 'wallet'],
    required: false,
  },
  validationCode: { 
    type: String,
    default: () => Math.random().toString(36).substring(2, 8).toUpperCase(), 
  },
  acceptedAt: { 
    type: Date,
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

orderSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();

  // Mettre à jour queuePosition si le statut est pending_validation ou awaiting_validator
  if (['pending_validation', 'awaiting_validator'].includes(this.status)) {
    const Order = mongoose.model('Order');
    const pendingOrders = await Order.countDocuments({
      supermarketId: this.supermarketId,
      locationId: this.locationId,
      status: { $in: ['pending_validation', 'awaiting_validator'] },
      _id: { $ne: this._id }, 
    });
    this.queuePosition = pendingOrders + 1;
  }

  next();
});

orderSchema.index({ supermarketId: 1, locationId: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);