require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database/db');
const { authenticateToken, requireAdmin, requireClient } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── AUTH ROUTES ───────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, client_id: user.client_id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role, client_id: user.client_id } });
});

// POST /api/auth/signup (clients only)
app.post('/api/auth/signup', (req, res) => {
  const { username, email, password, company_name, contact_name, phone, address, industry } = req.body;
  if (!username || !email || !password || !company_name) {
    return res.status(400).json({ error: 'Username, email, password, and company name are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const password_hash = bcrypt.hashSync(password, 10);

  const insertClient = db.prepare(`
    INSERT INTO clients (company_name, contact_name, email, phone, address, industry)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const clientResult = insertClient.run(company_name, contact_name || username, email, phone || '', address || '', industry || 'General');
  const client_id = clientResult.lastInsertRowid;

  db.prepare(`
    INSERT INTO users (username, email, password_hash, role, client_id) VALUES (?, ?, ?, 'client', ?)
  `).run(username, email, password_hash, client_id);

  res.status(201).json({ message: 'Account created successfully. You can now sign in.' });
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, username, email, role, client_id, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ─── ADMIN ROUTES ──────────────────────────────────────────────

// GET /api/admin/stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  const totalLicenses = db.prepare('SELECT COUNT(*) as count FROM licenses').get().count;
  const activeLicenses = db.prepare("SELECT COUNT(*) as count FROM licenses WHERE status = 'active'").get().count;
  const expiringSoon = db.prepare("SELECT COUNT(*) as count FROM licenses WHERE status IN ('expiring_soon', 'urgent')").get().count;
  const expired = db.prepare("SELECT COUNT(*) as count FROM licenses WHERE status = 'expired'").get().count;
  const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
  const totalSoftware = db.prepare('SELECT COUNT(*) as count FROM software_products').get().count;
  const totalCostResult = db.prepare('SELECT SUM(cost_per_year) as total FROM licenses WHERE status != ?').get('expired');
  const totalCost = totalCostResult.total || 0;
  const unreadNotifs = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE is_read = 0 AND target_role IN ('admin','all')").get().count;

  // License status distribution
  const statusDist = db.prepare(`
    SELECT status, COUNT(*) as count FROM licenses GROUP BY status
  `).all();

  // Cost by category
  const costByCategory = db.prepare(`
    SELECT sp.category, SUM(l.cost_per_year) as total_cost
    FROM licenses l JOIN software_products sp ON l.software_id = sp.id
    GROUP BY sp.category ORDER BY total_cost DESC
  `).all();

  // Top clients by license count
  const topClients = db.prepare(`
    SELECT c.company_name, COUNT(la.id) as license_count
    FROM clients c LEFT JOIN license_assignments la ON c.id = la.client_id
    GROUP BY c.id ORDER BY license_count DESC LIMIT 6
  `).all();

  // Monthly renewal timeline (next 12 months)
  const renewalTimeline = db.prepare(`
    SELECT strftime('%Y-%m', renewal_date) as month, COUNT(*) as count, SUM(cost_per_year) as cost
    FROM licenses
    WHERE renewal_date >= date('now') AND renewal_date <= date('now', '+12 months')
    GROUP BY month ORDER BY month
  `).all();

  // Upcoming renewals (next 30 days)
  const upcomingRenewals = db.prepare(`
    SELECT l.*, sp.name as software_name, sp.vendor, sp.category, c.company_name,
    CAST(julianday(l.renewal_date) - julianday('now') AS INTEGER) as days_left
    FROM licenses l
    JOIN software_products sp ON l.software_id = sp.id
    LEFT JOIN license_assignments la ON l.id = la.license_id
    LEFT JOIN clients c ON la.client_id = c.id
    WHERE l.renewal_date <= date('now', '+30 days') AND l.status != 'expired'
    ORDER BY l.renewal_date ASC
  `).all();

  res.json({ totalLicenses, activeLicenses, expiringSoon, expired, totalClients, totalSoftware, totalCost, unreadNotifs, statusDist, costByCategory, topClients, renewalTimeline, upcomingRenewals });
});

// ── Clients ──
app.get('/api/admin/clients', authenticateToken, requireAdmin, (req, res) => {
  const clients = db.prepare(`
    SELECT c.*, COUNT(la.id) as license_count
    FROM clients c LEFT JOIN license_assignments la ON c.id = la.client_id
    GROUP BY c.id ORDER BY c.created_at DESC
  `).all();
  res.json(clients);
});

app.post('/api/admin/clients', authenticateToken, requireAdmin, (req, res) => {
  const { company_name, contact_name, email, phone, address, industry } = req.body;
  if (!company_name || !email) return res.status(400).json({ error: 'Company name and email required' });
  const result = db.prepare('INSERT INTO clients (company_name, contact_name, email, phone, address, industry) VALUES (?,?,?,?,?,?)').run(company_name, contact_name, email, phone, address, industry || 'General');
  res.status(201).json({ id: result.lastInsertRowid, message: 'Client created' });
});

app.put('/api/admin/clients/:id', authenticateToken, requireAdmin, (req, res) => {
  const { company_name, contact_name, email, phone, address, industry } = req.body;
  db.prepare('UPDATE clients SET company_name=?, contact_name=?, email=?, phone=?, address=?, industry=? WHERE id=?').run(company_name, contact_name, email, phone, address, industry, req.params.id);
  res.json({ message: 'Client updated' });
});

app.delete('/api/admin/clients/:id', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ message: 'Client deleted' });
});

// ── Software ──
app.get('/api/admin/software', authenticateToken, requireAdmin, (req, res) => {
  const software = db.prepare(`
    SELECT sp.*, COUNT(l.id) as license_count
    FROM software_products sp LEFT JOIN licenses l ON sp.id = l.software_id
    GROUP BY sp.id ORDER BY sp.created_at DESC
  `).all();
  res.json(software);
});

app.post('/api/admin/software', authenticateToken, requireAdmin, (req, res) => {
  const { name, vendor, category, description, website } = req.body;
  if (!name || !vendor) return res.status(400).json({ error: 'Name and vendor required' });
  const result = db.prepare('INSERT INTO software_products (name, vendor, category, description, website) VALUES (?,?,?,?,?)').run(name, vendor, category || 'Other', description, website);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Software created' });
});

app.put('/api/admin/software/:id', authenticateToken, requireAdmin, (req, res) => {
  const { name, vendor, category, description, website } = req.body;
  db.prepare('UPDATE software_products SET name=?, vendor=?, category=?, description=?, website=? WHERE id=?').run(name, vendor, category, description, website, req.params.id);
  res.json({ message: 'Software updated' });
});

app.delete('/api/admin/software/:id', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM software_products WHERE id = ?').run(req.params.id);
  res.json({ message: 'Software deleted' });
});

// ── Licenses ──
app.get('/api/admin/licenses', authenticateToken, requireAdmin, (req, res) => {
  const licenses = db.prepare(`
    SELECT l.*, sp.name as software_name, sp.vendor, sp.category,
    c.company_name as client_name,
    CAST(julianday(l.renewal_date) - julianday('now') AS INTEGER) as days_left
    FROM licenses l
    JOIN software_products sp ON l.software_id = sp.id
    LEFT JOIN license_assignments la ON l.id = la.license_id
    LEFT JOIN clients c ON la.client_id = c.id
    ORDER BY l.renewal_date ASC
  `).all();
  res.json(licenses);
});

app.post('/api/admin/licenses', authenticateToken, requireAdmin, (req, res) => {
  const { software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, notes } = req.body;
  if (!software_id || !license_type || !purchase_date) return res.status(400).json({ error: 'Software, type, and purchase date required' });

  let status = 'active';
  if (renewal_date) {
    const daysLeft = Math.ceil((new Date(renewal_date) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) status = 'expired';
    else if (daysLeft <= 7) status = 'urgent';
    else if (daysLeft <= 30) status = 'expiring_soon';
  }

  const result = db.prepare('INSERT INTO licenses (software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, status, notes) VALUES (?,?,?,?,?,?,?,?,?)').run(software_id, license_key, license_type, total_seats || 1, cost_per_year || 0, purchase_date, renewal_date, status, notes);
  res.status(201).json({ id: result.lastInsertRowid, message: 'License created' });
});

app.put('/api/admin/licenses/:id', authenticateToken, requireAdmin, (req, res) => {
  const { software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, notes } = req.body;

  let status = 'active';
  if (renewal_date) {
    const daysLeft = Math.ceil((new Date(renewal_date) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) status = 'expired';
    else if (daysLeft <= 7) status = 'urgent';
    else if (daysLeft <= 30) status = 'expiring_soon';
  }

  db.prepare('UPDATE licenses SET software_id=?, license_key=?, license_type=?, total_seats=?, cost_per_year=?, purchase_date=?, renewal_date=?, status=?, notes=? WHERE id=?').run(software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, status, notes, req.params.id);
  res.json({ message: 'License updated' });
});

app.delete('/api/admin/licenses/:id', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM licenses WHERE id = ?').run(req.params.id);
  res.json({ message: 'License deleted' });
});

// ── Assignments ──
app.get('/api/admin/assignments', authenticateToken, requireAdmin, (req, res) => {
  const assignments = db.prepare(`
    SELECT la.*, c.company_name, sp.name as software_name, sp.vendor,
    l.license_type, l.renewal_date, l.status as license_status
    FROM license_assignments la
    JOIN clients c ON la.client_id = c.id
    JOIN licenses l ON la.license_id = l.id
    JOIN software_products sp ON l.software_id = sp.id
    ORDER BY la.assigned_date DESC
  `).all();
  res.json(assignments);
});

app.post('/api/admin/assignments', authenticateToken, requireAdmin, (req, res) => {
  const { license_id, client_id, seats_allocated, assigned_date, notes } = req.body;
  if (!license_id || !client_id) return res.status(400).json({ error: 'License and client required' });

  const existing = db.prepare('SELECT id FROM license_assignments WHERE license_id = ? AND client_id = ?').get(license_id, client_id);
  if (existing) return res.status(409).json({ error: 'This license is already assigned to this client' });

  const result = db.prepare('INSERT INTO license_assignments (license_id, client_id, seats_allocated, assigned_date, notes) VALUES (?,?,?,?,?)').run(license_id, client_id, seats_allocated || 1, assigned_date || new Date().toISOString().split('T')[0], notes);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Assignment created' });
});

app.put('/api/admin/assignments/:id', authenticateToken, requireAdmin, (req, res) => {
  const { seats_allocated, notes } = req.body;
  db.prepare('UPDATE license_assignments SET seats_allocated=?, notes=? WHERE id=?').run(seats_allocated, notes, req.params.id);
  res.json({ message: 'Assignment updated' });
});

app.delete('/api/admin/assignments/:id', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM license_assignments WHERE id = ?').run(req.params.id);
  res.json({ message: 'Assignment deleted' });
});

// ── Users (admin manage) ──
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at, c.company_name
    FROM users u LEFT JOIN clients c ON u.client_id = c.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

app.post('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const { username, email, password, role, client_id } = req.body;
  if (!username || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
  if (role === 'admin') return res.status(403).json({ error: 'Cannot create admin accounts via this endpoint' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, email, password_hash, role, client_id) VALUES (?,?,?,?,?)').run(username, email, password_hash, role, client_id || null);
  res.status(201).json({ id: result.lastInsertRowid, message: 'User created' });
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { username, email, is_active, client_id } = req.body;
  db.prepare('UPDATE users SET username=?, email=?, is_active=?, client_id=? WHERE id=?').run(username, email, is_active, client_id || null, req.params.id);
  res.json({ message: 'User updated' });
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  if (req.user.id == req.params.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
});

// ── Notifications (admin) ──
app.get('/api/admin/notifications', authenticateToken, requireAdmin, (req, res) => {
  const notifications = db.prepare(`
    SELECT n.*, sp.name as software_name, c.company_name
    FROM notifications n
    LEFT JOIN licenses l ON n.related_license_id = l.id
    LEFT JOIN software_products sp ON l.software_id = sp.id
    LEFT JOIN clients c ON n.target_client_id = c.id
    WHERE n.target_role IN ('admin', 'all')
    ORDER BY n.created_at DESC
  `).all();
  res.json(notifications);
});

app.put('/api/admin/notifications/:id/read', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Marked as read' });
});

app.put('/api/admin/notifications/read-all', authenticateToken, requireAdmin, (req, res) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE target_role IN ('admin','all')").run();
  res.json({ message: 'All marked as read' });
});

// ─── CLIENT ROUTES ─────────────────────────────────────────────

app.get('/api/client/dashboard', authenticateToken, requireClient, (req, res) => {
  const clientId = req.user.client_id;
  if (!clientId) return res.status(400).json({ error: 'No client associated with this account' });

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);

  const licenses = db.prepare(`
    SELECT l.*, sp.name as software_name, sp.vendor, sp.category, sp.description, sp.website,
    la.seats_allocated, la.assigned_date, la.notes as assignment_notes,
    CAST(julianday(l.renewal_date) - julianday('now') AS INTEGER) as days_left
    FROM license_assignments la
    JOIN licenses l ON la.license_id = l.id
    JOIN software_products sp ON l.software_id = sp.id
    WHERE la.client_id = ?
    ORDER BY l.renewal_date ASC
  `).all(clientId);

  const categoryBreakdown = db.prepare(`
    SELECT sp.category, COUNT(*) as count
    FROM license_assignments la
    JOIN licenses l ON la.license_id = l.id
    JOIN software_products sp ON l.software_id = sp.id
    WHERE la.client_id = ?
    GROUP BY sp.category
  `).all(clientId);

  const totalCost = licenses.reduce((sum, l) => sum + (l.cost_per_year || 0), 0);
  const activeLicenses = licenses.filter(l => l.status === 'active').length;
  const expiring = licenses.filter(l => ['expiring_soon', 'urgent'].includes(l.status)).length;
  const expired = licenses.filter(l => l.status === 'expired').length;

  const unreadNotifs = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE is_read = 0 AND target_client_id = ?").get(clientId).count;

  res.json({ client, licenses, categoryBreakdown, totalCost, activeLicenses, expiring, expired, unreadNotifs });
});

app.get('/api/client/notifications', authenticateToken, requireClient, (req, res) => {
  const notifications = db.prepare(`
    SELECT n.*, sp.name as software_name
    FROM notifications n
    LEFT JOIN licenses l ON n.related_license_id = l.id
    LEFT JOIN software_products sp ON l.software_id = sp.id
    WHERE n.target_client_id = ? OR n.target_role = 'all'
    ORDER BY n.created_at DESC
  `).all(req.user.client_id);
  res.json(notifications);
});

app.put('/api/client/notifications/:id/read', authenticateToken, requireClient, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Marked as read' });
});

app.put('/api/client/notifications/read-all', authenticateToken, requireClient, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE target_client_id = ?').run(req.user.client_id);
  res.json({ message: 'All marked as read' });
});

// ─── SERVE FRONTEND ────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html')));
app.get('/client', (req, res) => res.sendFile(path.join(__dirname, 'public', 'client', 'dashboard.html')));

app.listen(PORT, () => {
  console.log(`[Server] Nyeri IT Solutions running on http://localhost:${PORT}`);
});
