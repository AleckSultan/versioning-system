// versioning-system/database/init.js
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true // Allows running multi-statement schema scripts
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DATABASE || 'nyeri_it'}\`;`);
    await connection.query(`USE \`${process.env.DATABASE || 'nyeri_it'}\`;`);

    console.log('[DB] Setting up MySQL schema...');
    
    // Create tables (MySQL syntax adjustments: AUTO_INCREMENT, removed unsupported inline CHECK constraints if strict, or kept standard MySQL ENUMs/CHECKs)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(50),
        address TEXT,
        industry VARCHAR(100) DEFAULT 'General',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'client') NOT NULL,
        client_id INT DEFAULT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS software_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        vendor VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        website VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS licenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        software_id INT NOT NULL,
        license_key VARCHAR(255),
        license_type ENUM('perpetual', 'subscription', 'per-seat', 'open-source') NOT NULL,
        total_seats INT DEFAULT 1,
        cost_per_year DECIMAL(10,2) DEFAULT 0,
        purchase_date DATE NOT NULL,
        renewal_date DATE,
        status ENUM('active', 'expiring_soon', 'urgent', 'expired', 'inactive') DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (software_id) REFERENCES software_products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS license_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_id INT NOT NULL,
        client_id INT NOT NULL,
        seats_allocated INT DEFAULT 1,
        assigned_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_license_client (license_id, client_id),
        FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('urgent', 'warning', 'expired', 'info', 'success') NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        related_license_id INT DEFAULT NULL,
        target_role ENUM('admin', 'client', 'all') NOT NULL,
        target_client_id INT DEFAULT NULL,
        is_read TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (related_license_id) REFERENCES licenses(id) ON DELETE CASCADE,
        FOREIGN KEY (target_client_id) REFERENCES clients(id) ON DELETE CASCADE
      );
    `);

    // Check if seeded
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
    if (users[0].count > 0) {
      console.log('[DB] Database already seeded.');
      await connection.end();
      return;
    }

    console.log('🌱 Seeding MySQL database...');
    const saltRounds = 10;

    // Seed Admins
    const adminPass1 = bcrypt.hashSync('Admin@2026!', saltRounds);
    const adminPass2 = bcrypt.hashSync('Nyeri@Admin99', saltRounds);
    await connection.query(
      'INSERT INTO users (username, email, password_hash, role, client_id) VALUES ?',
      [
        ['Super Admin', 'admin@nyeriit.com', adminPass1, 'admin', null],
        ['Jane Kamau', 'jane.kamau@nyeriit.com', adminPass2, 'admin', null]
      ]
    );

    // Seed Clients
    const [clientRes] = await connection.query(
      'INSERT INTO clients (company_name, contact_name, email, phone, address, industry) VALUES ?',
      [
        ['Savanna Logistics Ltd', 'Peter Mwangi', 'peter.mwangi@savannalogistics.co.ke', '+254 711 234 567', 'Nairobi, Kenya', 'Logistics'],
        ['Kilimanjaro Fintech', 'Grace Odhiambo', 'grace@kilifintech.co.ke', '+254 722 345 678', 'Mombasa, Kenya', 'Finance'],
        ['Serengeti Media Group', 'Ali Hassan', 'ali.hassan@serengeti.co.ke', '+254 733 456 789', 'Kisumu, Kenya', 'Media'],
        ['Baobab Healthcare', 'Fatuma Wanjiru', 'fatuma@baobabhealth.co.ke', '+254 744 567 890', 'Nakuru, Kenya', 'Healthcare']
      ]
    );
    const c1 = clientRes.insertId;
    const c2 = c1 + 1;
    const c3 = c1 + 2;
    const c4 = c1 + 3;

    // Seed Client Users
    const cp1 = bcrypt.hashSync('Client@2026', saltRounds);
    await connection.query(
      'INSERT INTO users (username, email, password_hash, role, client_id) VALUES ?',
      [
        ['Peter Mwangi', 'peter.mwangi@savannalogistics.co.ke', cp1, 'client', c1],
        ['Grace Odhiambo', 'grace@kilifintech.co.ke', cp1, 'client', c2],
        ['Ali Hassan', 'ali.hassan@serengeti.co.ke', cp1, 'client', c3],
        ['Fatuma Wanjiru', 'fatuma@baobabhealth.co.ke', cp1, 'client', c4]
      ]
    );

    // Seed Software Products
    const [softwareRes] = await connection.query(
      'INSERT INTO software_products (name, vendor, category, description, website) VALUES ?',
      [
        ['Microsoft 365 Business', 'Microsoft', 'Productivity', 'Office suite with Teams, Word, Excel, and cloud storage', 'https://microsoft.com'],
        ['Adobe Creative Cloud', 'Adobe', 'Design', 'Complete creative suite including Photoshop, Illustrator, and Premiere', 'https://adobe.com'],
        ['Kaspersky Endpoint Security', 'Kaspersky', 'Security', 'Enterprise endpoint protection and threat management', 'https://kaspersky.com'],
        ['QuickBooks Enterprise', 'Intuit', 'Accounting', 'Full-featured accounting and payroll management', 'https://quickbooks.intuit.com'],
        ['Zoom Business Pro', 'Zoom', 'Communication', 'Video conferencing with advanced admin controls', 'https://zoom.us'],
        ['Slack Pro', 'Salesforce', 'Communication', 'Business messaging and collaboration platform', 'https://slack.com'],
        ['AutoCAD LT', 'Autodesk', 'Engineering', '2D drafting and documentation software', 'https://autodesk.com'],
        ['Bitdefender GravityZone', 'Bitdefender', 'Security', 'Cloud-based endpoint security management', 'https://bitdefender.com']
      ]
    );
    const s1 = softwareRes.insertId;

    // Seed Licenses
    const [licRes] = await connection.query(
      'INSERT INTO licenses (software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, status, notes) VALUES ?',
      [
        [s1, 'M365-SVNN-A1B2-C3D4', 'per-seat', 25, 7500, '2025-11-05', '2026-11-08', 'urgent', 'Savanna Logistics primary license'],
        [s1 + 2, 'KES-KLF-X9Y8-Z7W6', 'per-seat', 15, 3200, '2025-11-20', '2026-11-20', 'urgent', 'Kilimanjaro endpoint security'],
        [s1 + 1, 'ACC-SER-Q1W2-E3R4', 'subscription', 10, 6000, '2025-11-30', '2026-11-25', 'expiring_soon', 'Serengeti design team license'],
        [s1 + 4, 'ZM-BAO-T5Y6-U7I8', 'subscription', 50, 1800, '2025-12-01', '2026-11-30', 'expiring_soon', 'Baobab company-wide Zoom'],
        [s1 + 3, 'QB-KLF-O9P0-A1S2', 'perpetual', 5, 4500, '2024-01-15', '2027-01-15', 'active', 'Kilimanjaro accounting'],
        [s1 + 5, 'SLK-SER-D3F4-G5H6', 'subscription', 30, 2400, '2025-05-01', '2027-05-01', 'active', 'Serengeti team Slack'],
        [s1 + 6, 'ACD-BAO-J7K8-L9M0', 'per-seat', 8, 5200, '2024-06-15', '2027-06-15', 'active', 'Baobab engineering team'],
        [s1 + 7, 'BDF-SVNN-N1O2-P3Q4', 'per-seat', 20, 2800, '2023-10-01', '2026-10-01', 'expired', 'Savanna security — renewal needed'],
        [s1, 'M365-KLF-R5S6-T7U8', 'per-seat', 20, 6000, '2025-11-05', '2027-11-05', 'active', 'Kilimanjaro M365 suite'],
        [s1 + 2, 'KES-BAO-V9W0-X1Y2', 'per-seat', 30, 4800, '2025-11-05', '2027-04-01', 'active', 'Baobab endpoint protection']
      ]
    );
    const l1 = licRes.insertId;

    // Seed Assignments
    await connection.query(
      'INSERT INTO license_assignments (license_id, client_id, seats_allocated, assigned_date, notes) VALUES ?',
      [
        [l1, c1, 25, '2025-11-05', 'Full deployment for all Savanna staff'],
        [l1 + 1, c2, 15, '2025-11-20', 'All Kilimanjaro devices covered'],
        [l1 + 2, c3, 10, '2025-11-30', 'Creative team full license'],
        [l1 + 3, c4, 50, '2025-12-01', 'Company-wide video conferencing'],
        [l1 + 4, c2, 5, '2024-01-15', 'Finance department'],
        [l1 + 5, c3, 30, '2025-05-01', 'All Serengeti employees'],
        [l1 + 6, c4, 8, '2024-06-15', 'Architecture & engineering department'],
        [l1 + 7, c1, 20, '2023-10-01', 'Expired — needs renewal'],
        [l1 + 8, c2, 20, '2025-11-05', 'Full M365 for Kilimanjaro'],
        [l1 + 9, c4, 30, '2025-11-05', 'Full endpoint protection']
      ]
    );

    // Seed Notifications
    await connection.query(
      'INSERT INTO notifications (type, title, message, related_license_id, target_role, target_client_id) VALUES ?',
      [
        ['urgent', 'License Expiring in 3 Days', 'Microsoft 365 Business (Savanna Logistics) renews on Nov 8, 2026. Immediate action required.', l1, 'admin', null],
        ['urgent', 'Kaspersky License Expiring Soon', 'Kaspersky Endpoint Security (Kilimanjaro) renews on Nov 20, 2026. Only 15 days remaining.', l1 + 1, 'admin', null],
        ['warning', 'Adobe Creative Cloud Renewal Due', 'Adobe Creative Cloud (Serengeti Media) renews Nov 25, 2026. 20 days remaining.', l1 + 2, 'admin', null],
        ['warning', 'Zoom Business Pro Renewal Approaching', 'Zoom Business Pro (Baobab Healthcare) renews Nov 30, 2026.', l1 + 3, 'admin', null],
        ['expired', 'License Expired: Bitdefender GravityZone', 'Bitdefender GravityZone for Savanna Logistics expired on Oct 1, 2026. Please renew immediately.', l1 + 7, 'admin', null],
        ['urgent', 'Your Microsoft 365 License Is Expiring', 'Your Microsoft 365 Business license expires in 3 days (Nov 8, 2026). Contact Nyeri IT Solutions.', l1, 'client', c1],
        ['urgent', 'Kaspersky Security License Expiring', 'Your Kaspersky Endpoint Security license expires Nov 20, 2026. Please contact your IT provider.', l1 + 1, 'client', c2],
        ['warning', 'Adobe Creative Cloud Renewal', 'Your Adobe Creative Cloud subscription renews Nov 25, 2026. Ensure payment is arranged.', l1 + 2, 'client', c3],
        ['warning', 'Zoom License Renewal Reminder', 'Your Zoom Business Pro license renews Nov 30, 2026.', l1 + 3, 'client', c4],
        ['expired', 'Bitdefender License Has Expired', 'Your Bitdefender GravityZone has expired. Your devices may be unprotected.', l1 + 7, 'client', c1]
      ]
    );

    console.log('[DB] MySQL Database successfully initialized and seeded.');
  } catch (err) {
    console.error('[DB] Initialization error:', err);
  } finally {
    await connection.end();
  }
}

initializeDatabase();