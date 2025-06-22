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
  promotedPrice: {
    type: Number, // Nouveau champ pour stocker le prix promu (optionnel)
    default: null,
  },
  activePromotion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Promotion', // Référence à la promotion active (facultatif)
    default: null,
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

// Hook pour mettre à jour promotedPrice si une promotion est appliquée (à activer via contrôleur)
productSchema.methods.updatePromotedPrice = function(discountType, discountValue) {
  if (discountType === 'percentage') {
    this.promotedPrice = this.price * (1 - discountValue / 100);
  } else if (discountType === 'fixed') {
    this.promotedPrice = Math.max(0, this.price - discountValue);
  } else {
    this.promotedPrice = null;
  }
  return this.save();
};

module.exports = mongoose.model('Product', productSchema);