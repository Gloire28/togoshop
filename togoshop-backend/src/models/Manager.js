const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const managerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    set: value => value.trim(),
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  supermarketId: {
    type: String,
    ref: 'Supermarket',
    required: true,
  },
  locationId: {
    type: String,
    required: true,
  },
  roles: { 
    type: [String],
    required: true,
    validate: {
      validator: function(roles) {
        return roles.length === 2 && 
               roles.includes('order_validator') && 
               roles.includes('stock_manager');
      },
      message: 'Un manager doit avoir exactement les rôles "order_validator" et "stock_manager".'
    }
  },
  isAvailable: { 
    type: Boolean,
    default: true,
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

managerSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Manager', managerSchema);
