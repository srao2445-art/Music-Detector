require('dotenv').config();
const { ensureAdmin, dbPath } = require('../db');
ensureAdmin()
  .then((created) => {
    console.log(created ? `Database initialized and admin created at ${dbPath}` : `Database already initialized at ${dbPath}`);
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
