const Product = require('../models/Product');
const Supermarket = require('../models/Supermarket');
const mongoose = require('mongoose');

// Ajouter un nouveau produit
exports.createProduct = async (req, res) => {
  try {
    // Vérifier les autorisations (admin ou validateur avec rôle "stock_manager")
    if (req.user.role !== 'admin' && !(req.user.role === 'stock_manager' && req.user.supermarketId === req.body.supermarketId)) {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au gestionnaire de stock' });
    }

    const { name, description, price, category, supermarketId, stockByLocation, weight, isMadeInTogo, imageUrl } = req.body;

    // Vérifier les champs requis
    if (!name || !price || !category || !supermarketId || !stockByLocation || !Array.isArray(stockByLocation)) {
      return res.status(400).json({ message: 'Nom, prix, catégorie, supermarché et stock par site sont requis' });
    }

    // Ajout de la validation pour price
    if (price < 0) {
      return res.status(400).json({ message: 'Le prix du produit ne peut pas être négatif' });
    }

    // Ajout de la validation pour weight
    if (weight !== undefined && (typeof weight !== 'number' || weight <= 0)) {
      return res.status(400).json({ message: 'Le poids doit être un nombre positif' });
    }

    // Vérifier que le supermarché existe
    const supermarket = await Supermarket.findById(supermarketId);
    if (!supermarket) {
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    // Convertir le document Mongoose en objet JavaScript pur
    const supermarketObj = supermarket.toObject();
    console.log('Supermarché chargé:', JSON.stringify(supermarketObj, null, 2));

    // Valider le stock par site
    for (const stock of stockByLocation) {
      if (!stock.locationId || typeof stock.stock !== 'number' || stock.stock < 0) {
        return res.status(400).json({ message: 'Format de stock invalide : locationId et stock (nombre positif) requis' });
      }

      // Vérifier que le locationId existe dans le supermarché (soit dans sites, soit dans locations)
      let locationExists = false;

      // Vérifier dans sites
      const sites = supermarketObj.sites || [];
      console.log('Sites bruts:', sites);
      const sitesExist = sites.some(loc => {
        try {
          const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id.toString();
          const match = locId === stock.locationId;
          console.log(`Comparaison site _id: ${locId} avec locationId: ${stock.locationId}, Résultat: ${match}`);
          return match;
        } catch (error) {
          console.error(`Erreur lors de la comparaison dans sites pour loc: ${JSON.stringify(loc)}`, error);
          return false;
        }
      });
      locationExists = locationExists || sitesExist;
      console.log(`Sites vérifiés: ${sitesExist}`);

      // Vérifier dans locations
      const locations = supermarketObj.locations || [];
      console.log('Locations bruts:', locations);
      const locationsExist = locations.some(loc => {
        try {
          const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id.toString();
          const match = locId === stock.locationId;
          console.log(`Comparaison location _id: ${locId} avec locationId: ${stock.locationId}, Résultat: ${match}`);
          return match;
        } catch (error) {
          console.error(`Erreur lors de la comparaison dans locations pour loc: ${JSON.stringify(loc)}`, error);
          return false;
        }
      });
      locationExists = locationExists || locationsExist;
      console.log(`Locations vérifiées: ${locationsExist}`);

      console.log(`Location existe: ${locationExists}`);
      if (!locationExists) {
        return res.status(400).json({ message: `Site ${stock.locationId} invalide pour ce supermarché` });
      }
    }

    // Générer un _id pour le produit
    const product = new Product({
      _id: new mongoose.Types.ObjectId().toString(),
      name,
      description,
      price,
      category,
      supermarketId,
      stockByLocation,
      weight,
      isMadeInTogo: isMadeInTogo || false,
      imageUrl,
    });

    await product.save();

    res.status(201).json({ message: 'Produit créé avec succès', product });
  } catch (error) {
    console.error('Erreur lors de la création du produit:', error.message);
    res.status(500).json({ message: 'Erreur lors de la création du produit', error: error.message });
  }
};

// Récupérer les produits d’un supermarché
exports.getProductsBySupermarket = async (req, res) => {
  try {
    const { supermarketId } = req.params;
    const { locationId, category } = req.query; // Filtres optionnels

    console.log('SupermarketId reçu:', supermarketId); // Log pour débogage
    console.log('Query params:', { locationId, category }); // Log supplémentaire

    // Valider que supermarketId est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(supermarketId)) {
      console.log('Erreur: ID du supermarché invalide');
      return res.status(400).json({ message: 'ID du supermarché invalide' });
    }

    // Vérifier que le supermarché existe
    const supermarket = await Supermarket.findById(supermarketId);
    if (!supermarket) {
      console.log('Erreur: Supermarché non trouvé');
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    const supermarketObj = supermarket.toObject();

    // Construire la requête (supermarketId est maintenant toujours une chaîne)
    let query = { supermarketId: supermarketId };
    if (category) {
      // Normaliser la catégorie pour gérer les caractères non-ASCII
      const normalizedCategory = category.normalize('NFC');
      query.category = normalizedCategory;
    }

    console.log('Requête MongoDB:', query); // Log pour débogage
    const products = await Product.find(query);

    // Filtrer par locationId si fourni (pour ne retourner que le stock de ce site)
    if (locationId) {
      const locations = supermarketObj.locations || [];
      const sites = supermarketObj.sites || [];
      const locationExists = sites.some(loc => {
        const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id.toString();
        return locId === locationId;
      }) || locations.some(loc => {
        const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id.toString();
        return locId === locationId;
      });
      if (!locationExists) {
        console.log('Erreur: Site invalide pour ce supermarché');
        return res.status(400).json({ message: 'Site invalide pour ce supermarché' });
      }

      products.forEach(product => {
        product.stockByLocation = product.stockByLocation.filter(stock => stock.locationId === locationId);
      });
    }

    res.status(200).json(products);
  } catch (error) {
    console.error('Erreur dans getProductsBySupermarket:', error); // Log pour débogage
    res.status(500).json({ message: 'Erreur lors de la récupération des produits', error: error.message });
  }
};

// Récupérer un produit par ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du produit', error: error.message });
  }
};

// Mettre à jour un produit
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, stockByLocation, weight, isMadeInTogo, imageUrl } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    // Vérifier les autorisations (admin ou validateur avec rôle "stock_manager")
    if (req.user.role !== 'admin' && !(req.user.role === 'stock_manager' && req.user.supermarketId === product.supermarketId.toString())) {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au gestionnaire de stock' });
    }

    // Vérifier que le supermarché existe
    const supermarket = await Supermarket.findById(product.supermarketId);
    if (!supermarket) {
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    const supermarketObj = supermarket.toObject();

    // Ajout de la validation pour price
    if (price !== undefined && price < 0) {
      return res.status(400).json({ message: 'Le prix du produit ne peut pas être négatif' });
    }

    // Ajout de la validation pour weight
    if (weight !== undefined && (typeof weight !== 'number' || weight <= 0)) {
      return res.status(400).json({ message: 'Le poids doit être un nombre positif' });
    }

    // Mettre à jour les champs
    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (category) product.category = category;
    if (weight !== undefined) product.weight = weight;
    if (isMadeInTogo !== undefined) product.isMadeInTogo = isMadeInTogo;
    if (imageUrl) product.imageUrl = imageUrl;

    // Mettre à jour le stock par site
    if (stockByLocation && Array.isArray(stockByLocation)) {
      for (const stock of stockByLocation) {
        if (!stock.locationId || typeof stock.stock !== 'number' || stock.stock < 0) {
          return res.status(400).json({ message: 'Format de stock invalide : locationId et stock (nombre positif) requis' });
        }
        const locations = supermarketObj.locations || [];
        const sites = supermarketObj.sites || [];
        const locationExists = sites.some(loc => {
          const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id.toString();
          return locId === stock.locationId;
        }) || locations.some(loc => {
          const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id.toString();
          return locId === stock.locationId;
        });
        if (!locationExists) {
          return res.status(400).json({ message: `Site ${stock.locationId} invalide pour ce supermarché` });
        }
      }
      product.stockByLocation = stockByLocation;
    }

    await product.save();

    res.status(200).json({ message: 'Produit mis à jour avec succès', product });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du produit', error: error.message });
  }
};

// Supprimer un produit
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    // Vérifier les autorisations (admin ou validateur avec rôle "stock_manager")
    if (req.user.role !== 'admin' && !(req.user.role === 'stock_manager' && req.user.supermarketId === product.supermarketId.toString())) {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au gestionnaire de stock' });
    }

    // Vérifier que le supermarché existe
    const supermarket = await Supermarket.findById(product.supermarketId);
    if (!supermarket) {
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    await Product.deleteOne({ _id: id });

    res.status(200).json({ message: 'Produit supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du produit:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du produit', error: error.message });
  }
};