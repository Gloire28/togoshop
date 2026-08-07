require('dotenv').config();
const mongoose = require('mongoose');
const Supermarket = require('./src/models/Supermarket');
const Manager = require('./src/models/Manager');
const Driver = require('./src/models/Driver');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connecté à MongoDB Atlas');

    // --- 1. Supermarché ---
    const supermarket = await Supermarket.create({
      _id: 'supermarket-001',
      name: 'Supermarché Central',
      subscriptionPlan: 'monthly',
      subscriptionStatus: 'active',
      locations: [
        {
          _id: 'location-001',
          name: 'Agoè',
          address: 'Rue de l\'exemple, Lomé',
          latitude: 6.1725,
          longitude: 1.2314,
        },
      ],
      status: 'open',
    });
    console.log('Supermarché créé :', supermarket._id);

    // --- 2. Manager ---
    const manager = await Manager.create({
      name: 'Manager Test',
      phone: '90000001',
      email: 'manager@togoshop.com',
      password: 'ChangeMoi123!',
      supermarketId: supermarket._id,
      locationId: 'location-001',
      roles: ['order_validator', 'stock_manager'],
    });
    console.log('Manager créé :', manager.email);

    // --- 3. Lier le manager au supermarché (champ managers[]) ---
    supermarket.managers.push({
      managerId: manager._id.toString(),
      locationId: 'location-001',
      role: ['order_validator', 'stock_manager'],
    });
    await supermarket.save();
    console.log('Manager lié au supermarché');

    // --- 4. Driver ---
    const driver = await Driver.create({
      name: 'Driver Test',
      email: 'driver@togoshop.com',
      password: 'ChangeMoi123!',
      phoneNumber: '90000002',
      vehicleDetails: 'Moto - AB-1234',
      status: 'available',
    });
    console.log('Driver créé :', driver.email);

    console.log('\n=== SEED TERMINÉ AVEC SUCCÈS ===');
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors du seed :', error.message);
    process.exit(1);
  }
};

seed();
