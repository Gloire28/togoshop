const Supermarket = require('../models/Supermarket');
const Manager = require('../models/Manager');
const mongoose = require('mongoose');
const Promotion = require('../models/Promotion');
const Product = require('../models/Product');

// Créer un nouveau supermarché
exports.createSupermarket = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est un administrateur
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur' });
    }

    const { name, subscriptionPlan, locations, branding } = req.body;

    // Vérifier les champs requis
    if (!name || !subscriptionPlan || !locations || !Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ message: 'Nom, abonnement et au moins un site sont requis' });
    }

    // Valider le format des sites (locations)
    for (const location of locations) {
      if (!location.name || !location.address || !location.coordinates || typeof location.coordinates.lat !== 'number' || typeof location.coordinates.lng !== 'number') {
        return res.status(400).json({ message: 'Format de site invalide : nom, adresse et coordonnées (lat, lng) requis' });
      }
    }

    // Vérifier que le nom du supermarché est unique
    const existingSupermarket = await Supermarket.findOne({ name });
    if (existingSupermarket) {
      return res.status(400).json({ message: 'Ce nom de supermarché est déjà utilisé' });
    }

    // Mapper les locations pour correspondre au schéma
    const mappedLocations = locations.map(location => ({
      _id: new mongoose.Types.ObjectId().toString(),
      name: location.name,
      address: location.address,
      latitude: location.coordinates.lat,
      longitude: location.coordinates.lng,
    }));

    // Créer le supermarché avec les nouveaux champs par défaut
    const supermarketData = {
      _id: new mongoose.Types.ObjectId().toString(),
      name,
      subscriptionPlan,
      subscriptionStatus: 'active',
      locations: mappedLocations,
      branding: branding || {},
      managers: [],
      status: 'open', // Par défaut
      closureReason: null, // Par défaut
      scheduledClosure: { start: null, end: null }, // Par défaut
    };

    console.log('Données du supermarché avant création:', supermarketData);

    const supermarket = new Supermarket(supermarketData);

    await supermarket.save();

    res.status(201).json({ message: 'Supermarché créé avec succès', supermarket });
  } catch (error) {
    console.error('Erreur lors de la création:', error.message);
    res.status(500).json({ message: 'Erreur lors de la création du supermarché', error: error.message });
  }
};

// Récupérer les détails d’un supermarché
exports.getSupermarket = async (req, res) => {
  try {
    const { id } = req.params;

    const supermarket = await Supermarket.findById(id);
    if (!supermarket) {
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    res.status(200).json(supermarket);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du supermarché', error: error.message });
  }
};

// Mettre à jour un supermarché
exports.updateSupermarket = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subscriptionPlan, subscriptionStatus, locations, branding, status, closureReason, scheduledClosure } = req.body;

    const supermarket = await Supermarket.findById(id);
    if (!supermarket) {
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur' });
    }

    if (name) {
      const existingSupermarket = await Supermarket.findOne({ name, _id: { $ne: id } });
      if (existingSupermarket) {
        return res.status(400).json({ message: 'Ce nom de supermarché est déjà utilisé' });
      }
      supermarket.name = name;
    }
    if (subscriptionPlan) supermarket.subscriptionPlan = subscriptionPlan;
    if (subscriptionStatus) supermarket.subscriptionStatus = subscriptionStatus;
    if (branding) supermarket.branding = branding;
    if (status && ['open', 'closed', 'maintenance'].includes(status)) supermarket.status = status;
    if (closureReason !== undefined) supermarket.closureReason = closureReason;
    if (scheduledClosure && scheduledClosure.start && scheduledClosure.end) {
      if (new Date(scheduledClosure.start) > new Date(scheduledClosure.end)) {
        return res.status(400).json({ message: 'La date de début de fermeture doit être antérieure à la date de fin.' });
      }
      supermarket.scheduledClosure = scheduledClosure;
    }

    if (locations && Array.isArray(locations)) {
      for (const location of locations) {
        if (!location.name || !location.address || !location.coordinates || typeof location.coordinates.lat !== 'number' || typeof location.coordinates.lng !== 'number') {
          return res.status(400).json({ message: 'Format de site invalide : nom, adresse et coordonnées (lat, lng) requis' });
        }
      }
      supermarket.locations = locations.map(location => ({
        _id: location._id || new mongoose.Types.ObjectId().toString(),
        name: location.name,
        address: location.address,
        latitude: location.coordinates.lat,
        longitude: location.coordinates.lng,
      }));

      const managers = await Manager.find({ supermarketId: id });
      for (const manager of managers) {
        const locationExists = locations.some(loc => loc._id.toString() === manager.locationId);
        if (!locationExists) {
          await Manager.deleteOne({ _id: manager._id });
          supermarket.managers = supermarket.managers.filter(m => m.managerId.toString() !== manager._id.toString());
        }
      }
    }

    await supermarket.save();

    res.status(200).json({ message: 'Supermarché mis à jour avec succès', supermarket });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du supermarché', error: error.message });
  }
};

// Récupérer tous les supermarchés
exports.getAllSupermarkets = async (req, res) => {
  try {
    const supermarkets = await Supermarket.find();
    res.status(200).json({ data: supermarkets });
  } catch (error) {
    console.error('Erreur lors de la récupération des supermarchés:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération des supermarchés', error: error.message });
  }
};

// Basculer l'état du supermarché
exports.toggleSupermarketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, closureReason, scheduledClosure } = req.body;

    // Récupérer le supermarché
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) {
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    // Vérifier que l'utilisateur est un manager associé
    const manager = supermarket.managers.find(m => m.managerId === req.user.id);
    if (!manager) {
      return res.status(403).json({ message: 'Accès réservé aux managers de ce supermarché' });
    }

    // Valider le statut
    if (!status || !['open', 'closed', 'maintenance'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide. Utilisez "open", "closed" ou "maintenance".' });
    }

    // Mettre à jour les champs
    supermarket.status = status;
    supermarket.updatedAt = Date.now();
    if (closureReason !== undefined) {
      supermarket.closureReason = closureReason || null;
    }
    if (scheduledClosure && scheduledClosure.start && scheduledClosure.end) {
      if (new Date(scheduledClosure.start) > new Date(scheduledClosure.end)) {
        return res.status(400).json({ message: 'La date de début de fermeture doit être antérieure à la date de fin.' });
      }
      supermarket.scheduledClosure = scheduledClosure;
    } else {
      supermarket.scheduledClosure = { start: null, end: null };
    }

    // Synchroniser explicitement isOpen (bien que le hook pre('save') le fera)
    supermarket.isOpen = status === 'open';

    // Sauvegarder pour déclencher le hook pre('save')
    const updatedSupermarket = await supermarket.save();

    // Log de l'action
    console.log(`Statut modifié par ${req.user.id}: ${supermarket.status} -> ${status} à ${new Date().toISOString()}`);

    res.status(200).json({ message: 'Statut du supermarché mis à jour avec succès', supermarket: updatedSupermarket });
  } catch (error) {
    console.error('Erreur lors du basculement du statut:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut', error: error.message });
  }
};

// Récupérer l'état du supermarché
exports.getSupermarketStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const supermarket = await Supermarket.findById(id, 'status isOpen closureReason scheduledClosure');
    if (!supermarket) {
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    res.status(200).json({
      status: supermarket.status,
      isOpen: supermarket.isOpen,
      closureReason: supermarket.closureReason,
      scheduledClosure: supermarket.scheduledClosure,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du statut', error: error.message });
  }
};
