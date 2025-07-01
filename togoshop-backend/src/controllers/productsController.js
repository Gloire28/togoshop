const Product = require('../models/Product');
const Supermarket = require('../models/Supermarket');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { uploadFile, getSignedUrl } = require('../services/backblazeService');
const multer = require('multer');


// Création de produit
exports.createProduct = async (req, res) => {
  try {
    // Vérifier les autorisations 
    if (!req.user.roles.includes('admin') && !(req.user.roles.includes('stock_manager') && req.user.supermarketId === req.body.supermarketId)) {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au gestionnaire de stock' });
    }

    const { name, description, price, category, supermarketId, stockByLocation, weight, isMadeInTogo, imageUrl } = req.body;

    if (!name || !price || !category || !supermarketId || !stockByLocation || !Array.isArray(stockByLocation)) {
      return res.status(400).json({ message: 'Nom, prix, catégorie, supermarché et stock par site sont requis' });
    }

    if (price < 0) {
      return res.status(400).json({ message: 'Le prix du produit ne peut pas être négatif' });
    }

    if (weight !== undefined && (typeof weight !== 'number' || weight < 0)) {
      return res.status(400).json({ message: 'Le poids doit être un nombre positif ou zéro' });
    }

    const supermarket = await Supermarket.findById(supermarketId);
    if (!supermarket) {
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    if (supermarket.status !== 'open') {
      return res.status(400).json({ message: 'Impossible de créer un produit pour un supermarché fermé' });
    }

    const supermarketObj = supermarket.toObject();

    for (const stock of stockByLocation) {
      if (!stock.locationId || typeof stock.stock !== 'number' || stock.stock < 0) {
        return res.status(400).json({ message: 'Format de stock invalide : locationId et stock (nombre positif) requis' });
      }

      const locationExists = (supermarketObj.locations || []).some(loc => {
        const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id.toString();
        return locId === stock.locationId;
      });

      if (!locationExists) {
        return res.status(400).json({ message: `Site ${stock.locationId} invalide pour ce supermarché` });
      }
    }

    let finalImageUrl = imageUrl || '';
    let fileName = '';
    if (req.file) {
      fileName = `${uuidv4()}-${req.file.originalname}`;
      finalImageUrl = await uploadFile(`products/${fileName}`, req.file.buffer, req.file.mimetype);
      console.log('Image URL générée depuis fichier:', finalImageUrl);
    } else if (!imageUrl) {
      console.log('Aucune image fournie, imageUrl laissé vide.');
    } else {
      console.log('Utilisation de l\'imageUrl fourni:', imageUrl);
    }

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
      imageUrl: finalImageUrl,
      fileName,
    });

    await product.save();

    res.status(201).json({ message: 'Produit créé avec succès', product });
  } catch (error) {
    console.error('Erreur lors de la création du produit:', error.message);
    res.status(500).json({ message: 'Erreur lors de la création du produit', error: error.message });
  }
};

// Récupération des produits par supermarché
exports.getProductsBySupermarket = async (req, res) => {
  try {
    const { supermarketId } = req.params;
    const { locationId, category } = req.query;

    console.log('SupermarketId reçu:', supermarketId);
    console.log('Query params:', { locationId, category });

    if (!mongoose.Types.ObjectId.isValid(supermarketId)) {
      console.log('Erreur: ID du supermarché invalide');
      return res.status(400).json({ message: 'ID du supermarché invalide' });
    }

    const supermarket = await Supermarket.findById(supermarketId);
    if (!supermarket) {
      console.log('Erreur: Supermarché non trouvé');
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    const supermarketObj = supermarket.toObject();

    let query = { supermarketId: supermarketId };
    if (category) {
      const normalizedCategory = category.normalize('NFC');
      query.category = normalizedCategory;
      console.log(`Filtrage par catégorie: ${normalizedCategory}`);
    }

    console.log('Requête MongoDB:', query);
    const products = await Product.find(query);

    if (locationId) {
      const locationExists = (supermarketObj.locations || []).some(loc => {
        const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id.toString();
        return locId === locationId;
      });
      if (!locationExists) {
        console.log('Erreur: Site invalide pour ce supermarché');
        return res.status(400).json({ message: 'Site invalide pour ce supermarché' });
      }

      const filteredProducts = await Promise.all(products.map(async product => {
        try {
          const stockEntry = product.stockByLocation.find(stock => stock.locationId === locationId);
          const updatedStock = stockEntry ? [stockEntry] : [{ locationId: locationId, stock: 0, _id: new mongoose.Types.ObjectId() }];
          
          let finalImageUrl = product.imageUrl;
          if (finalImageUrl) {
            finalImageUrl = await getSignedUrl(finalImageUrl);
            console.log(`URL régénérée pour ${product.name} dans getProductsBySupermarket:`, finalImageUrl);
          }
          return { ...product.toObject(), stockByLocation: updatedStock, imageUrl: finalImageUrl };
        } catch (error) {
          console.error(`Erreur de traitement pour ${product.name}:`, error.message);
          return { ...product.toObject(), imageUrl: product.imageUrl };
        }
      }));
      console.log('Produits filtrés:', filteredProducts);
      return res.status(200).json(filteredProducts);
    }

    const productsWithSignedUrls = await Promise.all(products.map(async product => {
      try {
        let finalImageUrl = product.imageUrl;
        if (finalImageUrl) {
          finalImageUrl = await getSignedUrl(finalImageUrl); 
          console.log(`URL régénérée pour ${product.name} dans getProductsBySupermarket:`, finalImageUrl);
        }
        return { ...product.toObject(), imageUrl: finalImageUrl };
      } catch (error) {
        console.error(`Erreur de traitement pour ${product.name}:`, error.message);
        return { ...product.toObject(), imageUrl: product.imageUrl };
      }
    }));

    res.status(200).json(productsWithSignedUrls);
  } catch (error) {
    console.error('Erreur dans getProductsBySupermarket:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des produits', error: error.message });
  }
};

// Récupération d'un produit par ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    let product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    if (product.imageUrl) {
      product.imageUrl = await getSignedUrl(product.imageUrl);
      console.log(`URL régénérée pour ${product.name} dans getProductById:`, product.imageUrl);
    }

    if (locationId) {
      const stockEntry = product.stockByLocation.find(stock => stock.locationId === locationId);
      product = product.toObject();
      product.stockByLocation = stockEntry ? [stockEntry] : [{ locationId, stock: 0, _id: new mongoose.Types.ObjectId() }];
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du produit', error: error.message });
  }
};

// Récupérer les substituts d'un produit
exports.getSubstitutes = async (req, res) => {
  try {
    const { category, supermarketId, locationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(supermarketId)) {
      return res.status(400).json({ message: 'ID du supermarché invalide' });
    }

    const supermarket = await Supermarket.findById(supermarketId, 'status');
    if (!supermarket) {
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    const supermarketObj = supermarket.toObject();
    const locationExists = (supermarketObj.locations || []).some(loc => loc._id.toString() === locationId);
    if (!locationExists) {
      return res.status(400).json({ message: 'Site invalide pour ce supermarché' });
    }

    const substitutes = await Product.find({
      supermarketId,
      category: category.normalize('NFC'),
      _id: { $ne: req.query.excludeProductId },
      stockByLocation: {
        $elemMatch: { locationId: locationId, stock: { $gt: 0 } }
      }
    }).lean();

    if (supermarket.status !== 'open') {
      substitutes.forEach(sub => { sub.promotedPrice = null; });
    }

    res.status(200).json(substitutes);
  } catch (error) {
    console.error('Erreur lors de la récupération des substituts:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération des substituts', error: error.message });
  }
};

// Mettre à jour un produit
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, description, price, category, stockByLocation, weight, isMadeInTogo, imageUrl } = req.body;

    console.log('Données reçues:', req.body);

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    if (!req.user.roles.includes('admin') && !(req.user.roles.includes('stock_manager') && req.user.supermarketId === product.supermarketId.toString())) {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au gestionnaire de stock' });
    }

    const supermarket = await Supermarket.findById(product.supermarketId);
    if (!supermarket) {
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    if (supermarket.status !== 'open') {
      return res.status(400).json({ message: 'Impossible de modifier un produit pour un supermarché fermé' });
    }

    const supermarketObj = supermarket.toObject();

    if (price !== undefined && price < 0) {
      return res.status(400).json({ message: 'Le prix du produit ne peut pas être négatif' });
    }

    if (weight !== undefined && (typeof weight !== 'number' || weight < 0)) {
      return res.status(400).json({ message: 'Le poids doit être un nombre positif ou zéro' });
    }

    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (category) product.category = category;
    if (weight !== undefined) product.weight = weight;
    if (isMadeInTogo !== undefined) product.isMadeInTogo = isMadeInTogo;
    if (imageUrl) product.imageUrl = imageUrl;

    if (stockByLocation) {
      try {
        if (typeof stockByLocation === 'string') {
          stockByLocation = JSON.parse(stockByLocation);
        }
        
        if (!Array.isArray(stockByLocation)) {
          stockByLocation = [stockByLocation];
        }

        for (const stock of stockByLocation) {
          console.log('Entrée stock:', stock);
          if (!stock.locationId || typeof stock.stock !== 'number' || stock.stock < 0) {
            return res.status(400).json({ message: 'Format de stock invalide : locationId et stock (nombre positif) requis' });
          }
          
          const locationExists = (supermarketObj.locations || []).some(loc => {
            const locId = loc._id instanceof mongoose.Types.ObjectId ? loc._id.toString() : loc._id.toString();
            return locId === stock.locationId;
          });
          
          if (!locationExists) {
            return res.status(400).json({ message: `Site ${stock.locationId} invalide pour ce supermarché` });
          }

          const stockIndex = product.stockByLocation.findIndex(s => s.locationId === stock.locationId);
          console.log('Index trouvé:', stockIndex, 'Stock actuel:', product.stockByLocation);
          
          if (stockIndex !== -1) {
            product.stockByLocation[stockIndex].stock = stock.stock;
          } else {
            product.stockByLocation.push({ 
              locationId: stock.locationId, 
              stock: stock.stock 
            });
          }
        }
      } catch (parseError) {
        console.error('Erreur de parsing stockByLocation:', parseError);
        return res.status(400).json({ message: 'Format de stock invalide' });
      }
    }

    await product.save();
    console.log('Produit mis à jour:', product);

    res.status(200).json({ message: 'Produit mis à jour avec succès', product });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
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

    if (!req.user.roles.includes('admin') && !(req.user.roles.includes('stock_manager') && req.user.supermarketId === product.supermarketId.toString())) {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur ou au gestionnaire de stock' });
    }

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