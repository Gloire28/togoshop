const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');
const auth = require('../middleware/auth');
const multer = require('multer');
const { uploadFile, getSignedUrl } = require('../services/backblazeService');
const { v4: uuidv4 } = require('uuid');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') && ['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers JPEG et PNG sont autorisés'), false);
    }
  },
});

router.post('/upload-image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier image fourni' });
    }

    const fileName = `${uuidv4()}-${req.file.originalname}`;
    const imageUrl = await uploadFile(fileName, req.file.buffer, req.file.mimetype);

    res.status(200).json({ message: 'Image uploadée avec succès', imageUrl });
  } catch (error) {
    console.error('Erreur upload:', error);
    res.status(500).json({ message: 'Erreur lors de l\'upload de l\'image', error: error.message });
  }
});

// Middleware pour parser le FormData
const parseFormData = upload.none();
// Route pour ajouter un nouveau produit (nécessite authentification et upload d'image)
router.post('/', auth, upload.single('image'), productsController.createProduct);

// Route pour récupérer tous les produits d’un supermarché (publique)
router.get('/supermarket/:supermarketId', productsController.getProductsBySupermarket);

// Route pour récupérer un produit par ID (avec authentification)
router.get('/:id', auth, productsController.getProductById);

// Route pour récupérer les substituts d’un produit (publique)
router.get('/substitutes/:category/:supermarketId/:locationId', productsController.getSubstitutes);

// Route pour mettre à jour un produit (nécessite authentification)
router.put('/:id', auth, parseFormData, productsController.updateProduct);

// Route pour supprimer un produit (nécessite authentification)
router.delete('/:id', auth, productsController.deleteProduct);

module.exports = router;