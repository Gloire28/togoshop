// ~/togoshop/togoshop-backend/test-mongoose.js
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10
    });
    console.log('MongoDB connecté avec succès à:', process.env.MONGODB_URI);
  } catch (error) {
    console.error('Erreur de connexion à MongoDB:', error.message);
    process.exit(1);
  }
};

const SupermarketSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String },
  sites: [{
    _id: { type: String },
    name: { type: String },
    address: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
  }],
}, { collection: 'supermarkets' });

const Supermarket = mongoose.model('Supermarket', SupermarketSchema);

const test = async () => {
  await connectDB();
  const supermarket = await Supermarket.findOne({ _id: "68091a19d560ecfb2d26eeb5" });
  console.log('Supermarché récupéré:', supermarket);
  await mongoose.disconnect();
};

test();