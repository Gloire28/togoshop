const Manager = require('../models/Manager');
const Supermarket = require('../models/Supermarket');

// Inscription d'un nouveau manager (réservé aux admins)
exports.registerManager = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est un administrateur
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur' });
    }

    const { name, email, password, supermarketId, locationId } = req.body;

    // Vérifier les champs requis
    if (!name || !email || !password || !supermarketId || !locationId) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    // Vérifier que le supermarché existe
    const supermarket = await Supermarket.findById(supermarketId);
    if (!supermarket) {
      return res.status(404).json({ message: 'Supermarché non trouvé' });
    }

    // Vérifier que le locationId existe dans le supermarché
    const locationExists = supermarket.locations.some(loc => loc._id.toString() === locationId);
    if (!locationExists) {
      return res.status(400).json({ message: 'Site invalide pour ce supermarché' });
    }

    // Vérifier que l’email n’est pas déjà utilisé
    const existingManager = await Manager.findOne({ email });
    if (existingManager) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Créer le manager avec les deux rôles
    const manager = new Manager({
      name,
      email,
      password, // Le mot de passe sera haché automatiquement par le modèle
      supermarketId,
      locationId,
      roles: ['order_validator', 'stock_manager'], // Toujours les deux rôles
    });

    await manager.save();

    // Ajouter le manager à la liste des managers du supermarché
    supermarket.managers.push({ managerId: manager._id, locationId, roles: manager.roles });
    await supermarket.save();

    res.status(201).json({ message: 'Manager créé avec succès', manager });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l’inscription du manager', error: error.message });
  }
};

// Récupérer les informations du manager connecté
exports.getManager = async (req, res) => {
  try {
    const manager = await Manager.findById(req.user.id)
      .populate('supermarketId', 'name locations');
    if (!manager) {
      return res.status(404).json({ message: 'Manager non trouvé' });
    }
    res.status(200).json(manager);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des informations', error: error.message });
  }
};