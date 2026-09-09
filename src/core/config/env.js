const path = require('path');

const env = {
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'myabsence-production-secret-key-2026',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', '..', '..', 'data', 'myabsence.db'),
  isDev: process.env.NODE_ENV !== 'production'
};

module.exports = env;
