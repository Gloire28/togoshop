const express = require('express');
const connectDB = require('./config/database');
const orderRoutes = require('./routes/orders');
const managerRoutes = require('./routes/managers');
const supermarketRoutes = require('./routes/supermarkets');
const productRoutes = require('./routes/products');
const driverRoutes = require('./routes/drivers');
const paymentRoutes = require('./routes/payments');
const walletRoutes = require('./routes/wallets');
const trackingRoutes = require('./routes/tracking');
const promotionRoutes = require('./routes/promotions');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

const app = express();

// Connexion à MongoDB
connectDB();

// Middleware pour parser les requêtes JSON
app.use(express.json());

// Middleware de débogage
app.use((req, res, next) => {
  console.log(`Requête reçue: ${req.method} ${req.url}`);
  console.log('Params:', req.params);
  console.log('Query:', req.query);
  next();
});

// Route temporaire pour vérifier l'heure du serveur
app.get('/api/time', (req, res) => {
  res.json({ serverTime: new Date().toISOString() });
});

// Routes
app.use('/api/orders', orderRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/supermarkets', supermarketRoutes);
app.use('/api/products', productRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', require('./routes/notifications'));

app.get('/', (req, res) => {
  res.send('API TogoShop en fonctionnement');
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err.stack);
  res.status(500).json({ message: 'Erreur serveur', error: err.message });
});

// Lancement du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});