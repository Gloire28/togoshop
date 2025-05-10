const bcrypt = require('bcrypt');
const saltRounds = 10;
const password = "livreur123";
const hash = bcrypt.hashSync(password, saltRounds);
console.log(`Nouveau hash pour livreur123: ${hash}`);