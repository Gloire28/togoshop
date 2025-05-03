const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    console.log('MongoDB connecté avec succès à:', process.env.MONGODB_URI);
  } catch (error) {
    console.error('Erreur de connexion à MongoDB:', error.message);
    process.exit(1);
  }
};

const createAdmin = async () => {
  await connectDB();

  const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user', 'order_validator', 'stock_manager'], default: 'user' },
  }, { collection: 'users' });

  const User = mongoose.model('User', UserSchema);

  const email = 'superadmin@togoshop.com';
  const password = 'admin123';
  const role = 'admin';

  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('Utilisateur avec cet email existe déjà:', email);
      await mongoose.disconnect();
      return;
    }

    // Crypter le mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Créer un nouvel utilisateur
    const newUser = new User({
      _id: new mongoose.Types.ObjectId(),
      email,
      password: hashedPassword,
      role,
    });

    await newUser.save();
    console.log('Utilisateur admin créé avec succès:', newUser);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Erreur lors de la création de l’utilisateur:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

createAdmin();