const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'nyeri_it.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      address TEXT,
      industry TEXT DEFAULT 'General',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'client')),
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS software_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      vendor TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      website TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      software_id INTEGER NOT NULL REFERENCES software_products(id) ON DELETE CASCADE,
      license_key TEXT,
      license_type TEXT NOT NULL CHECK(license_type IN ('perpetual', 'subscription', 'per-seat', 'open-source')),
      total_seats INTEGER DEFAULT 1,
      cost_per_year REAL DEFAULT 0,
      purchase_date DATE NOT NULL,
      renewal_date DATE,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expiring_soon', 'urgent', 'expired', 'inactive')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS license_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      seats_allocated INTEGER DEFAULT 1,
      assigned_date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(license_id, client_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('urgent', 'warning', 'expired', 'info', 'success')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_license_id INTEGER REFERENCES licenses(id) ON DELETE CASCADE,
      target_role TEXT NOT NULL CHECK(target_role IN ('admin', 'client', 'all')),
      target_client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Check if already seeded
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) {
    console.log('[DB] Database already seeded.');
    return;
  }

  console.log('🌱 Seeding database...');

  const saltRounds = 10;

  // --- Seed Admin Users (cannot sign up) ---
  const adminPass1 = bcrypt.hashSync('Admin@2026!', saltRounds);
  const adminPass2 = bcrypt.hashSync('Nyeri@Admin99', saltRounds);

  const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash, role, client_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertUser.run('Super Admin', 'admin@nyeriit.com', adminPass1, 'admin', null);
  insertUser.run('Jane Kamau', 'jane.kamau@nyeriit.com', adminPass2, 'admin', null);

  // --- Seed Clients ---
  const insertClient = db.prepare(`
    INSERT INTO clients (company_name, contact_name, email, phone, address, industry)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const c1 = insertClient.run('Savanna Logistics Ltd', 'Peter Mwangi', 'peter.mwangi@savannalogistics.co.ke', '+254 711 234 567', 'Nairobi, Kenya', 'Logistics').lastInsertRowid;
  const c2 = insertClient.run('Kilimanjaro Fintech', 'Grace Odhiambo', 'grace@kilifintech.co.ke', '+254 722 345 678', 'Mombasa, Kenya', 'Finance').lastInsertRowid;
  const c3 = insertClient.run('Serengeti Media Group', 'Ali Hassan', 'ali.hassan@serengeti.co.ke', '+254 733 456 789', 'Kisumu, Kenya', 'Media').lastInsertRowid;
  const c4 = insertClient.run('Baobab Healthcare', 'Fatuma Wanjiru', 'fatuma@baobabhealth.co.ke', '+254 744 567 890', 'Nakuru, Kenya', 'Healthcare').lastInsertRowid;

  // --- Seed Client Users ---
  const cp1 = bcrypt.hashSync('Client@2026', saltRounds);
  insertUser.run('Peter Mwangi', 'peter.mwangi@savannalogistics.co.ke', cp1, 'client', c1);
  insertUser.run('Grace Odhiambo', 'grace@kilifintech.co.ke', cp1, 'client', c2);
  insertUser.run('Ali Hassan', 'ali.hassan@serengeti.co.ke', cp1, 'client', c3);
  insertUser.run('Fatuma Wanjiru', 'fatuma@baobabhealth.co.ke', cp1, 'client', c4);

  // --- Seed Software Products ---
  const insertSoftware = db.prepare(`
    INSERT INTO software_products (name, vendor, category, description, website)
    VALUES (?, ?, ?, ?, ?)
  `);

  const s1 = insertSoftware.run('Microsoft 365 Business', 'Microsoft', 'Productivity', 'Office suite with Teams, Word, Excel, and cloud storage', 'https://microsoft.com').lastInsertRowid;
  const s2 = insertSoftware.run('Adobe Creative Cloud', 'Adobe', 'Design', 'Complete creative suite including Photoshop, Illustrator, and Premiere', 'https://adobe.com').lastInsertRowid;
  const s3 = insertSoftware.run('Kaspersky Endpoint Security', 'Kaspersky', 'Security', 'Enterprise endpoint protection and threat management', 'https://kaspersky.com').lastInsertRowid;
  const s4 = insertSoftware.run('QuickBooks Enterprise', 'Intuit', 'Accounting', 'Full-featured accounting and payroll management', 'https://quickbooks.intuit.com').lastInsertRowid;
  const s5 = insertSoftware.run('Zoom Business Pro', 'Zoom', 'Communication', 'Video conferencing with advanced admin controls', 'https://zoom.us').lastInsertRowid;
  const s6 = insertSoftware.run('Slack Pro', 'Salesforce', 'Communication', 'Business messaging and collaboration platform', 'https://slack.com').lastInsertRowid;
  const s7 = insertSoftware.run('AutoCAD LT', 'Autodesk', 'Engineering', '2D drafting and documentation software', 'https://autodesk.com').lastInsertRowid;
  const s8 = insertSoftware.run('Bitdefender GravityZone', 'Bitdefender', 'Security', 'Cloud-based endpoint security management', 'https://bitdefender.com').lastInsertRowid;

  // --- Seed Licenses (with realistic renewal dates around Nov 2026) ---
  const insertLicense = db.prepare(`
    INSERT INTO licenses (software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const l1 = insertLicense.run(s1, 'M365-SVNN-A1B2-C3D4', 'per-seat', 25, 7500, '2025-11-05', '2026-11-08', 'urgent', 'Savanna Logistics primary license').lastInsertRowid;
  const l2 = insertLicense.run(s3, 'KES-KLF-X9Y8-Z7W6', 'per-seat', 15, 3200, '2025-11-20', '2026-11-20', 'urgent', 'Kilimanjaro endpoint security').lastInsertRowid;
  const l3 = insertLicense.run(s2, 'ACC-SER-Q1W2-E3R4', 'subscription', 10, 6000, '2025-11-30', '2026-11-25', 'expiring_soon', 'Serengeti design team license').lastInsertRowid;
  const l4 = insertLicense.run(s5, 'ZM-BAO-T5Y6-U7I8', 'subscription', 50, 1800, '2025-12-01', '2026-11-30', 'expiring_soon', 'Baobab company-wide Zoom').lastInsertRowid;
  const l5 = insertLicense.run(s4, 'QB-KLF-O9P0-A1S2', 'perpetual', 5, 4500, '2024-01-15', '2027-01-15', 'active', 'Kilimanjaro accounting').lastInsertRowid;
  const l6 = insertLicense.run(s6, 'SLK-SER-D3F4-G5H6', 'subscription', 30, 2400, '2025-05-01', '2027-05-01', 'active', 'Serengeti team Slack').lastInsertRowid;
  const l7 = insertLicense.run(s7, 'ACD-BAO-J7K8-L9M0', 'per-seat', 8, 5200, '2024-06-15', '2027-06-15', 'active', 'Baobab engineering team').lastInsertRowid;
  const l8 = insertLicense.run(s8, 'BDF-SVNN-N1O2-P3Q4', 'per-seat', 20, 2800, '2023-10-01', '2026-10-01', 'expired', 'Savanna security — renewal needed').lastInsertRowid;
  const l9 = insertLicense.run(s1, 'M365-KLF-R5S6-T7U8', 'per-seat', 20, 6000, '2025-11-05', '2027-11-05', 'active', 'Kilimanjaro M365 suite').lastInsertRowid;
  const l10 = insertLicense.run(s3, 'KES-BAO-V9W0-X1Y2', 'per-seat', 30, 4800, '2025-11-05', '2027-04-01', 'active', 'Baobab endpoint security').lastInsertRowid;

  // --- Seed Assignments ---
  const insertAssignment = db.prepare(`
    INSERT INTO license_assignments (license_id, client_id, seats_allocated, assigned_date, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertAssignment.run(l1, c1, 25, '2025-11-05', 'Full deployment for all Savanna staff');
  insertAssignment.run(l2, c2, 15, '2025-11-20', 'All Kilimanjaro devices covered');
  insertAssignment.run(l3, c3, 10, '2025-11-30', 'Creative team full license');
  insertAssignment.run(l4, c4, 50, '2025-12-01', 'Company-wide video conferencing');
  insertAssignment.run(l5, c2, 5, '2024-01-15', 'Finance department');
  insertAssignment.run(l6, c3, 30, '2025-05-01', 'All Serengeti employees');
  insertAssignment.run(l7, c4, 8, '2024-06-15', 'Architecture & engineering department');
  insertAssignment.run(l8, c1, 20, '2023-10-01', 'Expired — needs renewal');
  insertAssignment.run(l9, c2, 20, '2025-11-05', 'Full M365 for Kilimanjaro');
  insertAssignment.run(l10, c4, 30, '2025-11-05', 'Full endpoint protection');

  // --- Seed Notifications ---
  const insertNotif = db.prepare(`
    INSERT INTO notifications (type, title, message, related_license_id, target_role, target_client_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertNotif.run('urgent', 'License Expiring in 3 Days', 'Microsoft 365 Business (Savanna Logistics) renews on Nov 8, 2026. Immediate action required.', l1, 'admin', null);
  insertNotif.run('urgent', 'Kaspersky License Expiring Soon', 'Kaspersky Endpoint Security (Kilimanjaro) renews on Nov 20, 2026. Only 15 days remaining.', l2, 'admin', null);
  insertNotif.run('warning', 'Adobe Creative Cloud Renewal Due', 'Adobe Creative Cloud (Serengeti Media) renews Nov 25, 2026. 20 days remaining.', l3, 'admin', null);
  insertNotif.run('warning', 'Zoom Business Pro Renewal Approaching', 'Zoom Business Pro (Baobab Healthcare) renews Nov 30, 2026.', l4, 'admin', null);
  insertNotif.run('expired', 'License Expired: Bitdefender GravityZone', 'Bitdefender GravityZone for Savanna Logistics expired on Oct 1, 2026. Please renew immediately.', l8, 'admin', null);
  insertNotif.run('urgent', 'Your Microsoft 365 License Is Expiring', 'Your Microsoft 365 Business license expires in 3 days (Nov 8, 2026). Contact Nyeri IT Solutions.', l1, 'client', c1);
  insertNotif.run('urgent', 'Kaspersky Security License Expiring', 'Your Kaspersky Endpoint Security license expires Nov 20, 2026. Please contact your IT provider.', l2, 'client', c2);
  insertNotif.run('warning', 'Adobe Creative Cloud Renewal', 'Your Adobe Creative Cloud subscription renews Nov 25, 2026. Ensure payment is arranged.', l3, 'client', c3);
  insertNotif.run('warning', 'Zoom License Renewal Reminder', 'Your Zoom Business Pro license renews Nov 30, 2026.', l4, 'client', c4);
  insertNotif.run('expired', 'Bitdefender License Has Expired', 'Your Bitdefender GravityZone license has expired. Your devices may be unprotected. Contact Nyeri IT.', l8, 'client', c1);

  console.log('[DB] Database seeded successfully.');
  console.log('');
  console.log('[DB] Admin Credentials:');
  console.log('   Email: admin@nyeriit.com | Password: Admin@2026!');
  console.log('   Email: jane.kamau@nyeriit.com | Password: Nyeri@Admin99');
  console.log('');
  console.log('[DB] Client Credentials (all use password: Client@2026):');
  console.log('   peter.mwangi@savannalogistics.co.ke');
  console.log('   grace@kilifintech.co.ke');
  console.log('   ali.hassan@serengeti.co.ke');
  console.log('   fatuma@baobabhealth.co.ke');
}

function updateLicenseStatuses() {
  const today = new Date();
  const licenses = db.prepare('SELECT id, renewal_date FROM licenses').all();

  const updateStatus = db.prepare('UPDATE licenses SET status = ? WHERE id = ?');

  for (const lic of licenses) {
    if (!lic.renewal_date) continue;
    const renewal = new Date(lic.renewal_date);
    const daysLeft = Math.ceil((renewal - today) / (1000 * 60 * 60 * 24));

    let status = 'active';
    if (daysLeft < 0) status = 'expired';
    else if (daysLeft <= 7) status = 'urgent';
    else if (daysLeft <= 30) status = 'expiring_soon';

    updateStatus.run(status, lic.id);
  }
}

initializeDatabase();
updateLicenseStatuses();

module.exports = db;
