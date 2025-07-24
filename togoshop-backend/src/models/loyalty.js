const mongoose = require('mongoose');

const loyaltySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  points: {
    type: Number,
    default: 0,
    min: 0,
  },
  transactions: [
    {
      type: {
        type: String,
        enum: ['earned', 'redeemed', 'refunded'],
        required: true,
      },
      amount: {
        type: Number,
        required: true,
      },
      description: {
        type: String,
        required: true,
      },
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null, 
      },
      date: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

loyaltySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Loyalty', loyaltySchema);