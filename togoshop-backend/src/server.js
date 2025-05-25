const express = require('express');
const cors = require('cors');
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
const notificationRoutes = require('./routes/notifications');
const loyaltyRoutes = require('./routes/loyalty');

const app = express();

// Connexion à MongoDB
connectDB();

// Middleware pour parser les requêtes JSON
app.use(express.json());

// Liste des origines autorisées
const allowedOrigins = [
  'http://localhost:19006', // Expo Metro Bundler
  'http://localhost:5000', // Backend local
  'http://127.0.0.1:5000', // Alternative localhost
  'http://192.168.1.65:5000', // IP locale pour appareil physique
  'exp://192.168.1.65:19000', // Expo Go sur appareil physique
  'http://localhost:8081',
  /^exp:\/\/.+$/, // Regex pour toutes les URLs Expo Go
];

// Configuration CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      }
      return allowedOrigin.test(origin);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS bloqué pour l'origine: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
  ],
  exposedHeaders: ['Authorization'],
};

// Appliquer la configuration CORS
app.use(cors(corsOptions));

// Middleware pour les headers CORS (sécurité supplémentaire)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.some(allowedOrigin => {
    if (typeof allowedOrigin === 'string') return origin === allowedOrigin;
    return allowedOrigin.test(origin);
  })) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
  next();
});

// Middleware de débogage
app.use((req, res, next) => {
  console.log(`\n=== Nouvelle requête ===`);
  console.log(`Méthode: ${req.method} ${req.path}`);
  console.log(`Origine: ${req.headers.origin || 'directe'}`);
  console.log('Headers:', req.headers);
  // Log supplémentaire pour vérifier req.user après auth
  if (req.user) {
    console.log('req.user après middleware:', req.user);
  }
  next();
});

// Route de test
app.get('/api/info', (req, res) => {
  res.json({
    status: 'online',
    message: 'API TogoShop fonctionnelle',
    serverTime: new Date().toISOString(),
    corsConfig: corsOptions,
  });
});

// Routes API
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
app.use('/api/notifications', notificationRoutes);
app.use('/api/loyalty', loyaltyRoutes);

// Route racine
app.get('/', (req, res) => {
  res.send(`
    <h1>API TogoShop</h1>
    <p>Serveur en fonctionnement</p>
    <p>URL locale: http://localhost:5000/api</p>
    <p>IP locale: http://192.168.1.65:5000/api</p>
  `);
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur:', err.stack);
  res.status(500).json({
    error: err.message || 'Erreur serveur',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n=== SERVEUR DÉMARRÉ SUR LE PORT ${PORT} ===`);
  console.log(`URL locale: http://localhost:${PORT}`);
  console.log(`IP locale: http://192.168.1.65:${PORT}`);
  console.log(`Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log('Origines autorisées:', allowedOrigins);
});