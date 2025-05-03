const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../models/Product'); // Importer le modèle Product existant

const connectDB = async () => {
  try {
    // Fermer toute connexion existante
    await mongoose.disconnect();
    console.log('Connexion Mongoose existante fermée');

    // Se reconnecter
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10
    });
    console.log('MongoDB connecté avec succès à:', process.env.MONGODB_URI);

    // Lister les bases de données disponibles
    const adminDb = mongoose.connection.db.admin();
    const dbs = await adminDb.listDatabases();
    console.log('Bases de données disponibles:', dbs.databases);

    // Vérifier si la base togoshop existe et contient des données
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Collections dans togoshop:', collections.map(c => c.name));

    // Vérifier si le produit existe
    const product = await Product.findOne({ _id: new mongoose.Types.ObjectId("681392492f180187cbb7a51c") });
    console.log('Produit trouvé dans la base (via API):', product);
  } catch (error) {
    console.error('Erreur de connexion à MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;