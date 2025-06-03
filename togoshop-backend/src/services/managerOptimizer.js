const Manager = require('../models/Manager');
const Order = require('../models/Order');

exports.assignManager = async (supermarketId, locationId) => {
  try {
    console.log(`Recherche de validateur pour supermarketId: ${supermarketId}, locationId: ${locationId}`);

    // Trouver tous les managers pour ce supermarché et ce site
    const managers = await Manager.find({
      supermarketId: supermarketId,
      locationId: locationId,
      isAvailable: true,
      roles: { $in: ['order_validator'] }, // Filtrer les validateurs
    });

    console.log(`Managers trouvés dans le supermarché et site:`, managers);

    if (!managers.length) {
      throw new Error('Aucun validateur disponible pour ce supermarché et ce site');
    }

    // Calculer la charge de travail (nombre de commandes assignées)
    let selectedManager = managers[0];
    let minWorkload = Infinity;

    for (const manager of managers) {
      const workload = await Order.countDocuments({
        supermarketId: String(supermarketId),
        locationId: String(locationId),
        status: { $in: ['pending_validation', 'awaiting_validator'] },
        assignedManager: String(manager._id),
      });

      console.log(`Charge de travail pour manager ${manager._id}: ${workload}`);

      if (workload < minWorkload) {
        minWorkload = workload;
        selectedManager = manager;
      }
    }

    console.log(`Manager sélectionné: ${selectedManager._id}`);
    return selectedManager._id;
  } catch (error) {
    console.error('Erreur lors de l’assignation du validateur:', error.message);
    throw new Error(`Erreur lors de l’assignation du validateur : ${error.message}`);
  }
};