const bcrypt = require('bcrypt');

const saltRounds = 10;
const passwords = ["admin123", "livreur123", "manager123", "client123"];

passwords.forEach(password => {
  const hash = bcrypt.hashSync(password, saltRounds);
  console.log(`Hash for ${password}: ${hash}`);
});