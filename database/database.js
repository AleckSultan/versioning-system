// versioning-system/database/database.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DATABASE || 'nyeri_it',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection on startup
pool.getConnection()
  .then(connection => {
    console.log('[DB] Successfully connected to MySQL database.');
    connection.release();
  })
  .catch(err => {
    console.error('[DB] Database connection error:', err.message);
  });

module.exports = pool;