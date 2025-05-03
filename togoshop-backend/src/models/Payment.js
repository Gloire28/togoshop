const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Ajouté
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    // min: 0, // Retiré pour validation personnalisée
  },
  method: {
    type: String,
    enum: ['Flooz', 'TMoney', 'cash', 'wallet'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  centralAccountBalance: {
    type: Number,
    default: 0,
    // min: 0, // Retiré pour validation personnalisée
  },
  creditBalance: {
    type: Number,
    default: 0,
    // min: 0, // Retiré pour validation personnalisée
  },
  transactionId: {
    type: String,
    unique: true,
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

paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);