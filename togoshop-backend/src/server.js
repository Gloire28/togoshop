require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const mongoose = require('mongoose');
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
const Product = require('./models/Product');
const Promotion = require('./models/Promotion');
const multer = require('multer');

const app = express();

app.use(express.json());

const allowedOrigins = [
  'http://localhost:19006',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://192.168.1.89:5000',
  'exp://192.168.1.89:19000',
  'http://localhost:8081',
  /^exp:\/\/.+$/,
  'https://4c8b4341082f.ngrok-free.app',
  'https://togoshop.duckdns.org'
];

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

app.use((req, res, next) => {
  console.log('\n=== Requête reçue ===');
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log(`Chemin: ${req.path}, Base URL: ${req.baseUrl}`);
  console.log(`Origine: ${req.headers.origin || 'directe'}`);
  console.log('Headers:', {
    'Content-Type': req.headers['content-type'],
    Authorization: req.headers.authorization ? '[présent]' : '[absent]',
    'X-Requested-With': req.headers['x-requested-with'],
  });
  next();
});

app.get('/api/info', (req, res) => {
  res.json({
    status: 'online',
    message: 'API TogoShop fonctionnelle',
    serverTime: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: allowedOrigins,
  });
});

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

const upload = multer({ storage: multer.memoryStorage() });
app.use(upload.any());

app.get('/', (req, res) => {
  res.send(`
    <h1>API TogoShop</h1>
    <p>Serveur en fonctionnement</p>
    <p>URL locale: http://localhost:${process.env.PORT || 5000}/api</p>
    <p>IP locale: http://192.168.1.89:${process.env.PORT || 5000}/api</p>
    <p>Documentation: /api/docs (à venir)</p>
  `);
});

app.use((req, res) => {
  console.log(`[${new Date().toISOString()}] Route non trouvée: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: 'Route non trouvée' });
});

app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Erreur:`, err.stack);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Accès interdit par CORS' });
  }
  res.status(500).json({
    error: err.message || 'Erreur serveur',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

cron.schedule('*/5 * * * *', async () => {
  try {
    await autoAssignDrivers();
    console.log(`[${new Date().toISOString()}] Auto-assignation des livreurs effectuée`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erreur lors de l'auto-assignation des livreurs:`, error.message);
  }
});

cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();
    const expiredPromotions = await Promotion.find({
      endDate: { $lt: now },
      isActive: true,
    });

    if (expiredPromotions.length > 0) {
      for (const promo of expiredPromotions) {
        if (promo.productId) {
          await Product.updateOne(
            { _id: promo.productId },
            { $set: { promotedPrice: null, activePromotion: null } }
          );
          console.log(`[${new Date().toISOString()}] Produit ${promo.productId} mis à jour: promotedPrice et activePromotion réinitialisés`);
        }
      }
      await Promotion.updateMany(
        { _id: { $in: expiredPromotions.map(p => p._id) } },
        { $set: { isActive: false } }
      );
      console.log(`[${new Date().toISOString()}] ${expiredPromotions.length} promotions expirées désactivées`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erreur lors de la vérification des promotions expirées:`, error.message);
  }
});

const checkDependencies = async () => {
  try {
    await mongoose.connection.db.admin().ping();
    console.log(`[${new Date().toISOString()}] Connexion MongoDB vérifiée`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erreur de connexion MongoDB:`, error.message);
    throw error;
  }

  try {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379
    });
    await redis.ping();
    console.log(`[${new Date().toISOString()}] Connexion Redis vérifiée`);
    redis.quit();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erreur de connexion Redis:`, error.message);
    throw error;
  }
};

const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    await connectDB();
    await checkDependencies();
    app.listen(PORT, () => {
      console.log(`\n=== SERVEUR DÉMARRÉ SUR LE PORT ${PORT} ===`);
      console.log(`URL locale: http://localhost:${PORT}`);
      console.log(`IP locale: http://192.168.1.89:${PORT}`);
      console.log(`Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log('Origines autorisées:', allowedOrigins);
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erreur au démarrage du serveur:`, error.message);
    process.exit(1);
  }
};

startServer();
