/**
 * Run once after importing init.sql:
 *   node database/seed.js
 *
 * This replaces the placeholder password hashes with real bcrypt hashes.
 */
require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seed() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'nyeri_it',
  });

  console.log('[Seed] Connected. Hashing passwords...');

  const admin1Hash  = bcrypt.hashSync('Admin@2026!',   10);
  const admin2Hash  = bcrypt.hashSync('Nyeri@Admin99', 10);
  const clientHash  = bcrypt.hashSync('Client@2026',   10);

  await conn.execute('UPDATE users SET password_hash = ? WHERE id = 1', [admin1Hash]);
  await conn.execute('UPDATE users SET password_hash = ? WHERE id = 2', [admin2Hash]);
  await conn.execute('UPDATE users SET password_hash = ? WHERE id IN (3,4,5,6)', [clientHash]);

  console.log('[Seed] Passwords set.');
  console.log('');
  console.log('  Admin logins:');
  console.log('    admin@nyeriit.com        / Admin@2026!');
  console.log('    jane.kamau@nyeriit.com   / Nyeri@Admin99');
  console.log('');
  console.log('  Client logins (all use: Client@2026):');
  console.log('    peter.mwangi@savannalogistics.co.ke');
  console.log('    grace@kilifintech.co.ke');
  console.log('    ali.hassan@serengeti.co.ke');
  console.log('    fatuma@baobabhealth.co.ke');

  await conn.end();
}

seed().catch(err => {
  console.error('[Seed] Error:', err.message);
  process.exit(1);
});
