require('dotenv').config();
const { initializeDatabase, pool } = require('../db');

initializeDatabase()
  .then((created) => console.log(created ? 'PostgreSQL initialized and admin created with a bcrypt hash.' : 'PostgreSQL initialized; admin already exists.'))
  .catch((error) => { console.error(`Database initialization failed: ${error.message}`); process.exitCode = 1; })
  .finally(() => pool.end());
