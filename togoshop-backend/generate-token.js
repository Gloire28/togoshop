const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = () => {
  const payload = {
    id: '68123abc456def789ghi1011', // Remplace par l'_id de l'utilisateur créé
    role: 'admin'
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  console.log('Nouveau token:', token);
};

generateToken();
