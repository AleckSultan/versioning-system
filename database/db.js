require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'nyeri_it',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.getConnection()
  .then(conn => {
    console.log('[DB] Connected to MySQL.');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] Connection failed:', err.message);
    console.error('[DB] Make sure XAMPP MySQL is running and the database exists.');
    console.error('[DB] Run database/init.sql in phpMyAdmin to create and seed the database.');
  });

module.exports = pool;
