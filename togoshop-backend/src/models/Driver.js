const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: false,
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
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
  },
  vehicleDetails: {
    type: String,
    trim: true,
  },
  currentLocation: {
    lat: Number,
    lng: Number,
  },
  status: {
    type: String,
    enum: ['available', 'pending_pickup', 'busy', 'offline'], // Ajout de pending_pickup
    default: 'offline',
  },
  isDiscoverable: {
    type: Boolean,
    default: false,
  },
  earnings: {
    type: Number,
    default: 0,
    min: 0,
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

driverSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Driver', driverSchema);