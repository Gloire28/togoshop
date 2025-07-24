const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: false },
  password: { type: String, required: true },
  role: { type: String, default: 'client' },
  referralCode: { type: String, unique: true }, 
  referralCount: { type: Number, default: 0 },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Référence au parrain
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Middleware pour générer un code de parrainage unique avant la création
userSchema.pre('save', async function (next) {
  if (this.isNew && !this.referralCode) {
    this.referralCode = await generateUniqueReferralCode();
  }
  this.updatedAt = Date.now();
  next();
});

async function generateUniqueReferralCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const codeLength = 8;
  let code = '';

  for (let i = 0; i < codeLength; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  const existingUser = await mongoose.model('User').findOne({ referralCode: code });
  if (existingUser) {
    return generateUniqueReferralCode();
  }

  return code;
}

module.exports = mongoose.model('User', userSchema);