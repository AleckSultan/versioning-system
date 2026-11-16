require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database/database');
const { authenticateToken, requireAdmin, requireClient } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── AUTH ROUTES ───────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const [rows] = await db.execute('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, client_id: user.client_id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role, client_id: user.client_id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/signup (clients only)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password, company_name, contact_name, phone, address, industry } = req.body;
    if (!username || !email || !password || !company_name) {
      return res.status(400).json({ error: 'Username, email, password, and company name are required' });
    }

    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(409).json({ error: 'An account with this email already exists' });

    const password_hash = bcrypt.hashSync(password, 10);

    const [clientResult] = await db.execute(`
      INSERT INTO clients (company_name, contact_name, email, phone, address, industry)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [company_name, contact_name || username, email, phone || '', address || '', industry || 'General']);
    const client_id = clientResult.insertId;

    await db.execute(`
      INSERT INTO users (username, email, password_hash, role, client_id) VALUES (?, ?, ?, 'client', ?)
    `, [username, email, password_hash, client_id]);

    res.status(201).json({ message: 'Account created successfully. You can now sign in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, username, email, role, client_id, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN ROUTES ──────────────────────────────────────────────

// GET /api/admin/stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [totLic] = await db.query('SELECT COUNT(*) as count FROM licenses');
    const [actLic] = await db.query("SELECT COUNT(*) as count FROM licenses WHERE status = 'active'");
    const [expSoon] = await db.query("SELECT COUNT(*) as count FROM licenses WHERE status IN ('expiring_soon', 'urgent')");
    const [expiredLic] = await db.query("SELECT COUNT(*) as count FROM licenses WHERE status = 'expired'");
    const [totClients] = await db.query('SELECT COUNT(*) as count FROM clients');
    const [totSoftware] = await db.query('SELECT COUNT(*) as count FROM software_products');
    const [totCost] = await db.query('SELECT SUM(cost_per_year) as total FROM licenses WHERE status != ?', ['expired']);
    const [unreadNotifs] = await db.query("SELECT COUNT(*) as count FROM notifications WHERE is_read = 0 AND target_role IN ('admin','all')");

    // License status distribution
    const [statusDist] = await db.query(`
      SELECT status, COUNT(*) as count FROM licenses GROUP BY status
    `);

    // Cost by category
    const [costByCategory] = await db.query(`
      SELECT sp.category, SUM(l.cost_per_year) as total_cost
      FROM licenses l JOIN software_products sp ON l.software_id = sp.id
      GROUP BY sp.category ORDER BY total_cost DESC
    `);

    // Top clients by license count
    const [topClients] = await db.query(`
      SELECT c.company_name, COUNT(la.id) as license_count
      FROM clients c LEFT JOIN license_assignments la ON c.id = la.client_id
      GROUP BY c.id ORDER BY license_count DESC LIMIT 6
    `);

    // Monthly renewal timeline (next 12 months)
    const [renewalTimeline] = await db.query(`
      SELECT DATE_FORMAT(renewal_date, '%Y-%m') as month, COUNT(*) as count, SUM(cost_per_year) as cost
      FROM licenses
      WHERE renewal_date >= CURDATE() AND renewal_date <= DATE_ADD(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month
    `);

    // Upcoming renewals (next 30 days)
    const [upcomingRenewals] = await db.query(`
      SELECT l.*, sp.name as software_name, sp.vendor, sp.category, c.company_name,
      DATEDIFF(l.renewal_date, NOW()) as days_left
      FROM licenses l
      JOIN software_products sp ON l.software_id = sp.id
      LEFT JOIN license_assignments la ON l.id = la.license_id
      LEFT JOIN clients c ON la.client_id = c.id
      WHERE l.renewal_date <= DATE_ADD(NOW(), INTERVAL 30 DAY) AND l.status != 'expired'
      ORDER BY l.renewal_date ASC
    `);

    res.json({
      totalLicenses: totLic[0].count,
      activeLicenses: actLic[0].count,
      expiringSoon: expSoon[0].count,
      expired: expiredLic[0].count,
      totalClients: totClients[0].count,
      totalSoftware: totSoftware[0].count,
      totalCost: totCost[0].total || 0,
      unreadNotifs: unreadNotifs[0].count,
      statusDist,
      costByCategory,
      topClients,
      renewalTimeline,
      upcomingRenewals
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Clients ──
app.get('/api/admin/clients', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [clients] = await db.query(`
      SELECT c.*, COUNT(la.id) as license_count
      FROM clients c LEFT JOIN license_assignments la ON c.id = la.client_id
      GROUP BY c.id ORDER BY c.created_at DESC
    `);
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/clients', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { company_name, contact_name, email, phone, address, industry } = req.body;
    if (!company_name || !email) return res.status(400).json({ error: 'Company name and email required' });
    const [result] = await db.execute('INSERT INTO clients (company_name, contact_name, email, phone, address, industry) VALUES (?,?,?,?,?,?)', [company_name, contact_name, email, phone, address, industry || 'General']);
    res.status(201).json({ id: result.insertId, message: 'Client created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/clients/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { company_name, contact_name, email, phone, address, industry } = req.body;
    await db.execute('UPDATE clients SET company_name=?, contact_name=?, email=?, phone=?, address=?, industry=? WHERE id=?', [company_name, contact_name, email, phone, address, industry, req.params.id]);
    res.json({ message: 'Client updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/clients/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM clients WHERE id = ?', [req.params.id]);
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Software ──
app.get('/api/admin/software', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [software] = await db.query(`
      SELECT sp.*, COUNT(l.id) as license_count
      FROM software_products sp LEFT JOIN licenses l ON sp.id = l.software_id
      GROUP BY sp.id ORDER BY sp.created_at DESC
    `);
    res.json(software);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/software', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, vendor, category, description, website } = req.body;
    if (!name || !vendor) return res.status(400).json({ error: 'Name and vendor required' });
    const [result] = await db.execute('INSERT INTO software_products (name, vendor, category, description, website) VALUES (?,?,?,?,?)', [name, vendor, category || 'Other', description, website]);
    res.status(201).json({ id: result.insertId, message: 'Software created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/software/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, vendor, category, description, website } = req.body;
    await db.execute('UPDATE software_products SET name=?, vendor=?, category=?, description=?, website=? WHERE id=?', [name, vendor, category, description, website, req.params.id]);
    res.json({ message: 'Software updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/software/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM software_products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Software deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Licenses ──
app.get('/api/admin/licenses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [licenses] = await db.query(`
      SELECT l.*, sp.name as software_name, sp.vendor, sp.category,
      c.company_name as client_name,
      DATEDIFF(l.renewal_date, NOW()) as days_left
      FROM licenses l
      JOIN software_products sp ON l.software_id = sp.id
      LEFT JOIN license_assignments la ON l.id = la.license_id
      LEFT JOIN clients c ON la.client_id = c.id
      ORDER BY l.renewal_date ASC
    `);
    res.json(licenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/licenses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, notes } = req.body;
    if (!software_id || !license_type || !purchase_date) return res.status(400).json({ error: 'Software, type, and purchase date required' });

    let status = 'active';
    if (renewal_date) {
      const daysLeft = Math.ceil((new Date(renewal_date) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) status = 'expired';
      else if (daysLeft <= 7) status = 'urgent';
      else if (daysLeft <= 30) status = 'expiring_soon';
    }

    const [result] = await db.execute('INSERT INTO licenses (software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, status, notes) VALUES (?,?,?,?,?,?,?,?,?)', [software_id, license_key, license_type, total_seats || 1, cost_per_year || 0, purchase_date, renewal_date, status, notes]);
    res.status(201).json({ id: result.insertId, message: 'License created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, notes } = req.body;

    let status = 'active';
    if (renewal_date) {
      const daysLeft = Math.ceil((new Date(renewal_date) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) status = 'expired';
      else if (daysLeft <= 7) status = 'urgent';
      else if (daysLeft <= 30) status = 'expiring_soon';
    }

    await db.execute('UPDATE licenses SET software_id=?, license_key=?, license_type=?, total_seats=?, cost_per_year=?, purchase_date=?, renewal_date=?, status=?, notes=? WHERE id=?', [software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, status, notes, req.params.id]);
    res.json({ message: 'License updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM licenses WHERE id = ?', [req.params.id]);
    res.json({ message: 'License deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Assignments ──
app.get('/api/admin/assignments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [assignments] = await db.query(`
      SELECT la.*, c.company_name, sp.name as software_name, sp.vendor,
      l.license_type, l.renewal_date, l.status as license_status
      FROM license_assignments la
      JOIN clients c ON la.client_id = c.id
      JOIN licenses l ON la.license_id = l.id
      JOIN software_products sp ON l.software_id = sp.id
      ORDER BY la.assigned_date DESC
    `);
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/assignments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { license_id, client_id, seats_allocated, assigned_date, notes } = req.body;
    if (!license_id || !client_id) return res.status(400).json({ error: 'License and client required' });

    const [existing] = await db.execute('SELECT id FROM license_assignments WHERE license_id = ? AND client_id = ?', [license_id, client_id]);
    if (existing.length > 0) return res.status(409).json({ error: 'This license is already assigned to this client' });

    const [result] = await db.execute('INSERT INTO license_assignments (license_id, client_id, seats_allocated, assigned_date, notes) VALUES (?,?,?,?,?)', [license_id, client_id, seats_allocated || 1, assigned_date || new Date().toISOString().split('T')[0], notes]);
    res.status(201).json({ id: result.insertId, message: 'Assignment created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/assignments/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { seats_allocated, notes } = req.body;
    await db.execute('UPDATE license_assignments SET seats_allocated=?, notes=? WHERE id=?', [seats_allocated, notes, req.params.id]);
    res.json({ message: 'Assignment updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/assignments/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM license_assignments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Users (admin manage) ──
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at, c.company_name
      FROM users u LEFT JOIN clients c ON u.client_id = c.id
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role, client_id } = req.body;
    if (!username || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
    if (role === 'admin') return res.status(403).json({ error: 'Cannot create admin accounts via this endpoint' });

    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(409).json({ error: 'Email already in use' });

    const password_hash = bcrypt.hashSync(password, 10);
    const [result] = await db.execute('INSERT INTO users (username, email, password_hash, role, client_id) VALUES (?,?,?,?,?)', [username, email, password_hash, role, client_id || null]);
    res.status(201).json({ id: result.insertId, message: 'User created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, is_active, client_id } = req.body;
    await db.execute('UPDATE users SET username=?, email=?, is_active=?, client_id=? WHERE id=?', [username, email, is_active, client_id || null, req.params.id]);
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.user.id == req.params.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Notifications (admin) ──
app.get('/api/admin/notifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [notifications] = await db.query(`
      SELECT n.*, sp.name as software_name, c.company_name
      FROM notifications n
      LEFT JOIN licenses l ON n.related_license_id = l.id
      LEFT JOIN software_products sp ON l.software_id = sp.id
      LEFT JOIN clients c ON n.target_client_id = c.id
      WHERE n.target_role IN ('admin', 'all')
      ORDER BY n.created_at DESC
    `);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/notifications/:id/read', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/notifications/read-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.execute("UPDATE notifications SET is_read = 1 WHERE target_role IN ('admin','all')");
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CLIENT ROUTES ─────────────────────────────────────────────

app.get('/api/client/dashboard', authenticateToken, requireClient, async (req, res) => {
  try {
    const clientId = req.user.client_id;
    if (!clientId) return res.status(400).json({ error: 'No client associated with this account' });

    const [clientRows] = await db.execute('SELECT * FROM clients WHERE id = ?', [clientId]);
    const client = clientRows[0];

    const [licenses] = await db.execute(`
      SELECT l.*, sp.name as software_name, sp.vendor, sp.category, sp.description, sp.website,
      la.seats_allocated, la.assigned_date, la.notes as assignment_notes,
      DATEDIFF(l.renewal_date, NOW()) as days_left
      FROM license_assignments la
      JOIN licenses l ON la.license_id = l.id
      JOIN software_products sp ON l.software_id = sp.id
      WHERE la.client_id = ?
      ORDER BY l.renewal_date ASC
    `, [clientId]);

    const [categoryBreakdown] = await db.execute(`
      SELECT sp.category, COUNT(*) as count
      FROM license_assignments la
      JOIN licenses l ON la.license_id = l.id
      JOIN software_products sp ON l.software_id = sp.id
      WHERE la.client_id = ?
      GROUP BY sp.category
    `, [clientId]);

    const totalCost = licenses.reduce((sum, l) => sum + (parseFloat(l.cost_per_year) || 0), 0);
    const activeLicenses = licenses.filter(l => l.status === 'active').length;
    const expiring = licenses.filter(l => ['expiring_soon', 'urgent'].includes(l.status)).length;
    const expired = licenses.filter(l => l.status === 'expired').length;

    const [unreadRows] = await db.execute("SELECT COUNT(*) as count FROM notifications WHERE is_read = 0 AND target_client_id = ?", [clientId]);
    const unreadNotifs = unreadRows[0].count;

    res.json({ client, licenses, categoryBreakdown, totalCost, activeLicenses, expiring, expired, unreadNotifs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/client/notifications', authenticateToken, requireClient, async (req, res) => {
  try {
    const [notifications] = await db.execute(`
      SELECT n.*, sp.name as software_name
      FROM notifications n
      LEFT JOIN licenses l ON n.related_license_id = l.id
      LEFT JOIN software_products sp ON l.software_id = sp.id
      WHERE n.target_client_id = ? OR n.target_role = 'all'
      ORDER BY n.created_at DESC
    `, [req.user.client_id]);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/client/notifications/:id/read', authenticateToken, requireClient, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/client/notifications/read-all', authenticateToken, requireClient, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE target_client_id = ?', [req.user.client_id]);
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SERVE FRONTEND ────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html')));
app.get('/client', (req, res) => res.sendFile(path.join(__dirname, 'public', 'client', 'dashboard.html')));

app.listen(PORT, () => {
  console.log(`[Server] Nyeri IT Solutions running on http://localhost:${PORT}`);
});