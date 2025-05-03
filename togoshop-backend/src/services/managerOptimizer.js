const Supermarket = require('../models/Supermarket');
const Order = require('../models/Order');

exports.assignManager = async (supermarketId, locationId) => {
  try {
    // Trouver le supermarché en forçant _id comme String
    const supermarket = await Supermarket.findOne({ _id: String(supermarketId) });
    if (!supermarket) {
      throw new Error('Supermarché non trouvé');
    }

    // Log pour débogage
    console.log('Supermarché trouvé:', supermarket._id);
    console.log('Managers dans le supermarché:', JSON.stringify(supermarket.managers));

    // Trouver tous les validateurs pour ce supermarché et ce site
    const managers = supermarket.managers.filter(manager => 
      manager.role === 'order_validator' && manager.locationId === String(locationId)
    );

    console.log('Validateurs filtrés:', JSON.stringify(managers));

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
        assignedManager: String(manager.managerId), // S'assurer que c'est une chaîne
      });

      console.log(`Charge de travail pour manager ${manager.managerId}: ${workload}`);

      if (workload < minWorkload) {
        minWorkload = workload;
        selectedManager = manager;
      }
    }

    console.log(`Manager sélectionné: ${selectedManager.managerId}`);
    return selectedManager.managerId;
  } catch (error) {
    console.error('Erreur lors de l’assignation du validateur:', error.message);
    throw new Error(`Erreur lors de l’assignation du validateur : ${error.message}`);
  }
};