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
const { autoAssignDrivers } = require('./services/optimizer');
const multer = require('multer');

const app = express();

// Connexion à MongoDB
connectDB();

// Middleware pour parser les requêtes JSON
app.use(express.json());

// Configuration de multer pour parser multipart/form-data (globalement)
const upload = multer({ storage: multer.memoryStorage() });
app.use(upload.any()); // Appliqué à toutes les routes (peut être restreint si nécessaire)

// Liste des origines autorisées
const allowedOrigins = [
  'http://localhost:19006',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://192.168.1.74:5000',
  'exp://192.168.1.74:19000',
  'http://localhost:8081',
  /^exp:\/\/.+$/,
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
      console.log(`Origine bloquée par CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
};

app.use(cors(corsOptions));

// Middleware de débogage amélioré
app.use((req, res, next) => {
  console.log('\n=== Nouvelle requête ===');
  console.log(`Méthode: ${req.method} ${req.originalUrl}`);
  console.log(`Chemin: ${req.path}`);
  console.log(`Base URL: ${req.baseUrl}`);
  console.log(`Origine: ${req.headers.origin || 'directe'}`);
  console.log('Headers:', req.headers);
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
    <p>IP locale: http://192.168.1.74:5000/api</p>
  `);
});

// Middleware pour gérer les routes non trouvées
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Middleware de gestion des erreurs amélioré
app.use((err, req, res, next) => {
  console.error('Erreur:', err.stack);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Accès interdit par CORS' });
  }
  res.status(500).json({
    error: err.message || 'Erreur serveur',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Exécuter autoAssignDrivers toutes les 5 minutes
setInterval(async () => {
  try {
    await autoAssignDrivers();
    console.log('Auto-assignation des livreurs effectuée');
  } catch (error) {
    console.error('Erreur lors de l’auto-assignation des livreurs:', error.message);
  }
}, 5 * 60 * 1000); // 5 minutes

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n=== SERVEUR DÉMARRÉ SUR LE PORT', PORT, '===');
  console.log(`URL locale: http://localhost:${PORT}`);
  console.log(`IP locale: http://192.168.1.74:${PORT}`);
  console.log(`Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log('Origines autorisées:', allowedOrigins);
});