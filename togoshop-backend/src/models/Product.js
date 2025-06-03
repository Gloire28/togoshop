const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['Fruits', 'Légumes', 'Vêtements', 'Électronique', 'Viandes', 'Produits Laitiers', 'Épicerie', 'Boissons', 'Autres', 'Céréales'],
  },
  supermarketId: {
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    ref: 'Supermarket' 
  },
  stockByLocation: [{
    locationId: {
      type: String,
      required: true,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId()
    }
  }],
  weight: {
    type: Number,
    default: 1,
  },
  isMadeInTogo: {
    type: Boolean,
    default: false,
  },
  imageUrl: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { collection: 'products' });

productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Product', productSchema);