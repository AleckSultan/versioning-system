// ─── STATE ─────────────────────────────────────────────────────
let token = localStorage.getItem('nyeri_token');
let currentUser = JSON.parse(localStorage.getItem('nyeri_user') || 'null');
let allClients = [], allSoftware = [], allLicenses = [];
let statusChart, categoryChart, timelineChart, clientChart;
let confirmCallback = null;

// ─── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!token || !currentUser || currentUser.role !== 'admin') {
    window.location.href = '/';
    return;
  }
  updateThemeLabel();
  document.getElementById('sidebar-username').textContent = currentUser.username;
  document.getElementById('sidebar-avatar').textContent = currentUser.username.charAt(0).toUpperCase();
  loadDashboard();
  loadNotifPanel();
  setInterval(loadNotifPanel, 60000);
});

// ─── HELPERS ────────────────────────────────────────────────────
function updateThemeLabel() {
  const theme = ThemeManager.getTheme();
  document.getElementById('sidebar-theme-label').textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  if (res.status === 401 || res.status === 403) { logout(); return null; }
  return res;
}

function showToast(message, type = 'info') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 300); }, 3500);
}

function logout() {
  localStorage.removeItem('nyeri_token');
  localStorage.removeItem('nyeri_user');
  window.location.href = '/';
}

function formatDate(d) { return d ? dayjs(d).format('DD MMM YYYY') : '—'; }
function formatCost(n) { return n ? `KES ${Number(n).toLocaleString()}` : 'KES 0'; }

function statusBadge(status) {
  const labels = { active: 'Active', expiring_soon: 'Expiring Soon', urgent: 'Urgent', expired: 'Expired', inactive: 'Inactive' };
  const icons = { active: 'fa-circle-check', expiring_soon: 'fa-clock', urgent: 'fa-triangle-exclamation', expired: 'fa-circle-xmark', inactive: 'fa-circle-minus' };
  return `<span class="badge badge-${status}"><i class="fa-solid ${icons[status] || 'fa-circle'}"></i> ${labels[status] || status}</span>`;
}

function daysPill(days) {
  if (days === null || days === undefined) return '—';
  if (days < 0) return `<span class="days-pill expired"><i class="fa-solid fa-circle-xmark"></i> Expired</span>`;
  if (days <= 7) return `<span class="days-pill urgent"><i class="fa-solid fa-fire"></i> ${days}d</span>`;
  if (days <= 30) return `<span class="days-pill expiring"><i class="fa-solid fa-clock"></i> ${days}d</span>`;
  return `<span class="days-pill safe"><i class="fa-solid fa-circle-check"></i> ${days}d</span>`;
}

function notifIcon(type) {
  const map = { urgent: 'fa-fire', warning: 'fa-triangle-exclamation', expired: 'fa-circle-xmark', info: 'fa-circle-info', success: 'fa-circle-check' };
  return `<div class="notif-icon ${type}"><i class="fa-solid ${map[type] || 'fa-bell'}"></i></div>`;
}

// ─── VIEW SWITCHING ─────────────────────────────────────────────
const viewTitles = {
  dashboard: ['Dashboard', 'Admin / Overview'],
  clients: ['Clients', 'Admin / Clients'],
  software: ['Software Products', 'Admin / Software'],
  licenses: ['Licenses', 'Admin / Licenses'],
  assignments: ['Assignments', 'Admin / Assignments'],
  users: ['Users', 'Admin / Users'],
  notifications: ['Notifications', 'Admin / Notifications']
};

function switchView(view, el) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  if (el) el.classList.add('active');
  const [title, breadcrumb] = viewTitles[view] || [view, ''];
  document.getElementById('topbar-title').textContent = title;
  document.getElementById('topbar-breadcrumb').textContent = breadcrumb;

  const loaders = { clients: loadClients, software: loadSoftware, licenses: loadLicenses, assignments: loadAssignments, users: loadUsers, notifications: loadNotifications };
  if (loaders[view]) loaders[view]();
}

// ─── DASHBOARD ──────────────────────────────────────────────────
async function loadDashboard() {
  const res = await api('GET', '/admin/stats');
  if (!res) return;
  const d = await res.json();

  // Update notification badge
  updateNotifBadge(d.unreadNotifs);

  // KPI Cards
  const kpiData = [
    { label: 'Total Licenses', value: d.totalLicenses, icon: 'fa-key', color: 'purple', sub: `${d.activeLicenses} active` },
    { label: 'Total Clients', value: d.totalClients, icon: 'fa-building', color: 'blue', sub: 'Registered companies' },
    { label: 'Software Products', value: d.totalSoftware, icon: 'fa-box', color: 'teal', sub: 'Managed products' },
    { label: 'Expiring Soon', value: d.expiringSoon, icon: 'fa-clock', color: 'orange', sub: 'Within 30 days' },
    { label: 'Expired', value: d.expired, icon: 'fa-circle-xmark', color: 'red', sub: 'Needs renewal' },
    { label: 'Annual Cost', value: formatCost(d.totalCost), icon: 'fa-money-bill', color: 'green', sub: 'Active licenses only' }
  ];

  document.getElementById('kpi-grid').innerHTML = kpiData.map(k => `
    <div class="kpi-card ${k.color}">
      <div class="kpi-icon ${k.color}"><i class="fa-solid ${k.icon}"></i></div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>
  `).join('');

  // Chart defaults
  const chartDefaults = () => ({
    plugins: { legend: { labels: { font: { family: 'Inter', size: 12 }, color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#666' } } },
    maintainAspectRatio: false,
  });

  const gridColor = () => getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || 'rgba(0,0,0,0.08)';
  const textColor = () => getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#666';

  // Status doughnut
  const statusMap = { active: ['#3ab86e', 'Active'], expiring_soon: ['#f5c842', 'Expiring'], urgent: ['#f07a3a', 'Urgent'], expired: ['#e04040', 'Expired'], inactive: ['#999', 'Inactive'] };
  const statLabels = d.statusDist.map(s => statusMap[s.status]?.[1] || s.status);
  const statColors = d.statusDist.map(s => statusMap[s.status]?.[0] || '#ccc');

  if (statusChart) statusChart.destroy();
  statusChart = new Chart(document.getElementById('chart-status'), {
    type: 'doughnut',
    data: { labels: statLabels, datasets: [{ data: d.statusDist.map(s => s.count), backgroundColor: statColors, borderWidth: 0, hoverOffset: 8 }] },
    options: { ...chartDefaults(), cutout: '65%', plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, padding: 16, color: textColor() } } } }
  });

  // Cost by category bar
  const catColors = ['#7c5cbf','#e05c8a','#2bbfa0','#f07a3a','#3a86d4','#f5c842','#e04040','#3ab86e'];
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(document.getElementById('chart-category'), {
    type: 'bar',
    data: {
      labels: d.costByCategory.map(c => c.category),
      datasets: [{ label: 'Annual Cost (KES)', data: d.costByCategory.map(c => c.total_cost), backgroundColor: catColors.slice(0, d.costByCategory.length), borderRadius: 8, borderSkipped: false }]
    },
    options: { ...chartDefaults(), plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { color: textColor(), callback: v => `KES ${v.toLocaleString()}` } }, x: { grid: { display: false }, ticks: { color: textColor() } } } }
  });

  // Timeline line chart
  if (timelineChart) timelineChart.destroy();
  timelineChart = new Chart(document.getElementById('chart-timeline'), {
    type: 'line',
    data: {
      labels: d.renewalTimeline.map(t => dayjs(t.month + '-01').format('MMM YYYY')),
      datasets: [
        { label: 'Renewals', data: d.renewalTimeline.map(t => t.count), borderColor: '#7c5cbf', backgroundColor: 'rgba(124,92,191,0.12)', fill: true, tension: 0.4, pointBackgroundColor: '#7c5cbf', pointRadius: 5 },
        { label: 'Cost (KES)', data: d.renewalTimeline.map(t => t.cost), borderColor: '#e05c8a', backgroundColor: 'rgba(224,92,138,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#e05c8a', pointRadius: 5, yAxisID: 'y2' }
      ]
    },
    options: { ...chartDefaults(), interaction: { mode: 'index' }, scales: { y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { color: textColor() } }, y2: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { color: textColor(), callback: v => `${v.toLocaleString()}` } }, x: { grid: { display: false }, ticks: { color: textColor() } } } }
  });

  // Top clients horizontal bar
  if (clientChart) clientChart.destroy();
  clientChart = new Chart(document.getElementById('chart-clients'), {
    type: 'bar',
    data: {
      labels: d.topClients.map(c => c.company_name),
      datasets: [{ label: 'Licenses', data: d.topClients.map(c => c.license_count), backgroundColor: catColors.slice(0, d.topClients.length), borderRadius: 8, borderSkipped: false }]
    },
    options: { ...chartDefaults(), indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: gridColor() }, ticks: { color: textColor() } }, y: { grid: { display: false }, ticks: { color: textColor() } } } }
  });

  // Upcoming renewals
  const tbody = document.getElementById('upcoming-body');
  if (!d.upcomingRenewals.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-circle-check"></i><p>No licenses expiring in the next 30 days</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = d.upcomingRenewals.map(l => `
    <tr>
      <td><strong>${l.software_name}</strong><br><span class="text-muted">${l.vendor}</span></td>
      <td>${l.company_name || '<span class="text-muted">Unassigned</span>'}</td>
      <td><span class="badge badge-inactive" style="text-transform:capitalize;">${l.license_type}</span></td>
      <td>${formatDate(l.renewal_date)}</td>
      <td>${daysPill(l.days_left)}</td>
      <td>${formatCost(l.cost_per_year)}</td>
      <td>${statusBadge(l.status)}</td>
    </tr>
  `).join('');
}

// ─── NOTIFICATION PANEL ─────────────────────────────────────────
let notifPanelOpen = false;

function toggleNotifPanel() {
  notifPanelOpen = !notifPanelOpen;
  document.getElementById('notif-panel').classList.toggle('open', notifPanelOpen);
  if (notifPanelOpen) loadNotifPanel();
}

async function loadNotifPanel() {
  const res = await api('GET', '/admin/notifications');
  if (!res) return;
  const notifs = await res.json();
  const unread = notifs.filter(n => !n.is_read).length;
  updateNotifBadge(unread);

  const body = document.getElementById('notif-panel-body');
  if (!notifs.length) {
    body.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><p>No notifications</p></div>`;
    return;
  }

  body.innerHTML = notifs.slice(0, 10).map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" id="notif-${n.id}">
      ${notifIcon(n.type)}
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${dayjs(n.created_at).format('DD MMM YYYY, HH:mm')}</div>
      </div>
      ${!n.is_read ? `<button class="icon-btn" onclick="markRead(${n.id})" title="Mark as read"><i class="fa-solid fa-check"></i></button>` : ''}
    </div>
  `).join('');
}

function updateNotifBadge(count) {
  const badge = document.getElementById('sidebar-notif-badge');
  const dot = document.getElementById('topbar-notif-dot');
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
    dot.classList.add('show');
  } else {
    badge.style.display = 'none';
    dot.classList.remove('show');
  }
}

async function markRead(id) {
  await api('PUT', `/admin/notifications/${id}/read`);
  loadNotifPanel();
}

async function markAllRead() {
  await api('PUT', '/admin/notifications/read-all');
  showToast('All notifications marked as read', 'success');
  loadNotifPanel();
  loadNotifications();
}

// ─── CLIENTS ────────────────────────────────────────────────────
async function loadClients() {
  const res = await api('GET', '/admin/clients');
  if (!res) return;
  allClients = await res.json();
  const tbody = document.getElementById('clients-body');

  if (!allClients.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-building"></i><p>No clients yet. Add your first client.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = allClients.map(c => `
    <tr>
      <td><strong>${c.company_name}</strong></td>
      <td>${c.contact_name || '—'}</td>
      <td>${c.email}</td>
      <td>${c.phone || '—'}</td>
      <td><span class="badge badge-inactive">${c.industry || 'General'}</span></td>
      <td>${c.license_count}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="icon-btn edit" onclick="editClient(${c.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn delete" onclick="confirmDelete('client', ${c.id}, '${c.company_name}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  // Also populate selects
  populateClientSelects();
}

function populateClientSelects() {
  ['assignment-client', 'user-client'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Client --</option>' + allClients.map(c => `<option value="${c.id}">${c.company_name}</option>`).join('');
  });
}

function editClient(id) {
  const c = allClients.find(x => x.id === id);
  if (!c) return;
  document.getElementById('client-id').value = c.id;
  document.getElementById('client-company').value = c.company_name;
  document.getElementById('client-contact').value = c.contact_name || '';
  document.getElementById('client-email').value = c.email;
  document.getElementById('client-phone').value = c.phone || '';
  document.getElementById('client-industry').value = c.industry || 'General';
  document.getElementById('client-address').value = c.address || '';
  document.getElementById('client-modal-title').innerHTML = '<i class="fa-solid fa-building" style="color:var(--clay-purple);margin-right:8px;"></i>Edit Client';
  openModal('client-modal');
}

document.getElementById('client-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('client-id').value;
  const body = {
    company_name: document.getElementById('client-company').value,
    contact_name: document.getElementById('client-contact').value,
    email: document.getElementById('client-email').value,
    phone: document.getElementById('client-phone').value,
    industry: document.getElementById('client-industry').value,
    address: document.getElementById('client-address').value,
  };
  const method = id ? 'PUT' : 'POST';
  const path = id ? `/admin/clients/${id}` : '/admin/clients';
  const res = await api(method, path, body);
  if (!res) return;
  const data = await res.json();
  if (res.ok) { showToast(id ? 'Client updated' : 'Client added', 'success'); closeModal('client-modal'); loadClients(); }
  else showToast(data.error || 'Error saving client', 'error');
});

// ─── SOFTWARE ────────────────────────────────────────────────────
const softwareColors = ['purple','pink','teal','orange','blue','green','yellow','red'];
const softwareIcons = { Productivity: 'fa-file-word', Security: 'fa-shield-halved', Design: 'fa-pen-nib', Accounting: 'fa-calculator', Communication: 'fa-comments', Engineering: 'fa-drafting-compass', Development: 'fa-code', Analytics: 'fa-chart-line', Other: 'fa-box' };
const colorBgs = { purple: 'rgba(124,92,191,0.12)', pink: 'rgba(224,92,138,0.12)', teal: 'rgba(43,191,160,0.12)', orange: 'rgba(240,122,58,0.12)', blue: 'rgba(58,134,212,0.12)', green: 'rgba(58,184,110,0.12)', yellow: 'rgba(245,200,66,0.12)', red: 'rgba(224,64,64,0.12)' };
const colorFgs = { purple: '#7c5cbf', pink: '#e05c8a', teal: '#2bbfa0', orange: '#f07a3a', blue: '#3a86d4', green: '#3ab86e', yellow: '#c9a000', red: '#e04040' };

async function loadSoftware() {
  const res = await api('GET', '/admin/software');
  if (!res) return;
  allSoftware = await res.json();
  renderSoftwareCards(allSoftware);
  populateLicenseSoftwareSelect();
}

function renderSoftwareCards(list) {
  const grid = document.getElementById('software-grid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>No software products yet.</p></div>`;
    return;
  }
  grid.innerHTML = list.map((s, i) => {
    const col = softwareColors[i % softwareColors.length];
    const icon = softwareIcons[s.category] || 'fa-box';
    return `
    <div class="software-card" data-name="${s.name.toLowerCase()} ${s.vendor.toLowerCase()} ${s.category.toLowerCase()}">
      <div class="software-card-top">
        <div class="software-icon" style="background:${colorBgs[col]};color:${colorFgs[col]};"><i class="fa-solid ${icon}"></i></div>
        <div class="software-actions">
          <button class="icon-btn edit" onclick="editSoftware(${s.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn delete" onclick="confirmDelete('software', ${s.id}, '${s.name}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="software-name">${s.name}</div>
      <div class="software-vendor">${s.vendor}</div>
      <div class="software-meta">
        <span class="badge badge-inactive"><i class="fa-solid fa-tag"></i> ${s.category}</span>
        <span class="badge badge-active"><i class="fa-solid fa-key"></i> ${s.license_count} license${s.license_count !== 1 ? 's' : ''}</span>
      </div>
      ${s.description ? `<p class="text-muted mt-8" style="font-size:0.82rem;line-height:1.5;">${s.description}</p>` : ''}
    </div>`;
  }).join('');
}

function filterSoftwareCards(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.software-card').forEach(card => {
    card.style.display = card.dataset.name.includes(q) ? '' : 'none';
  });
}

function editSoftware(id) {
  const s = allSoftware.find(x => x.id === id);
  if (!s) return;
  document.getElementById('software-id').value = s.id;
  document.getElementById('software-name').value = s.name;
  document.getElementById('software-vendor').value = s.vendor;
  document.getElementById('software-category').value = s.category;
  document.getElementById('software-website').value = s.website || '';
  document.getElementById('software-desc').value = s.description || '';
  document.getElementById('software-modal-title').innerHTML = '<i class="fa-solid fa-box" style="color:var(--clay-teal);margin-right:8px;"></i>Edit Software';
  openModal('software-modal');
}

document.getElementById('software-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('software-id').value;
  const body = {
    name: document.getElementById('software-name').value,
    vendor: document.getElementById('software-vendor').value,
    category: document.getElementById('software-category').value,
    website: document.getElementById('software-website').value,
    description: document.getElementById('software-desc').value,
  };
  const method = id ? 'PUT' : 'POST';
  const path = id ? `/admin/software/${id}` : '/admin/software';
  const res = await api(method, path, body);
  if (!res) return;
  const data = await res.json();
  if (res.ok) { showToast(id ? 'Software updated' : 'Software added', 'success'); closeModal('software-modal'); loadSoftware(); }
  else showToast(data.error || 'Error saving software', 'error');
});

function populateLicenseSoftwareSelect() {
  const sel = document.getElementById('license-software');
  sel.innerHTML = '<option value="">-- Select Software --</option>' + allSoftware.map(s => `<option value="${s.id}">${s.name} (${s.vendor})</option>`).join('');
}

// ─── LICENSES ────────────────────────────────────────────────────
async function loadLicenses() {
  const res = await api('GET', '/admin/licenses');
  if (!res) return;
  allLicenses = await res.json();
  const filter = document.getElementById('license-status-filter').value;
  const filtered = filter ? allLicenses.filter(l => l.status === filter) : allLicenses;
  renderLicenses(filtered);
  populateAssignmentLicenseSelect();
}

function renderLicenses(list) {
  const tbody = document.getElementById('licenses-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fa-solid fa-key"></i><p>No licenses found.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(l => `
    <tr>
      <td><strong>${l.software_name}</strong><br><span class="text-muted">${l.vendor}</span></td>
      <td>${l.client_name || '<span class="text-muted">Unassigned</span>'}</td>
      <td><span class="badge badge-inactive" style="text-transform:capitalize;">${l.license_type}</span></td>
      <td>${l.total_seats}</td>
      <td>${formatCost(l.cost_per_year)}</td>
      <td>${formatDate(l.renewal_date)}</td>
      <td>${l.renewal_date ? daysPill(l.days_left) : '—'}</td>
      <td>${statusBadge(l.status)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="icon-btn edit" onclick="editLicense(${l.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn delete" onclick="confirmDelete('license', ${l.id}, '${l.software_name}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editLicense(id) {
  const l = allLicenses.find(x => x.id === id);
  if (!l) return;
  document.getElementById('license-id').value = l.id;
  document.getElementById('license-software').value = l.software_id;
  document.getElementById('license-type').value = l.license_type;
  document.getElementById('license-key').value = l.license_key || '';
  document.getElementById('license-seats').value = l.total_seats;
  document.getElementById('license-cost').value = l.cost_per_year;
  document.getElementById('license-purchase').value = l.purchase_date;
  document.getElementById('license-renewal').value = l.renewal_date || '';
  document.getElementById('license-notes').value = l.notes || '';
  document.getElementById('license-modal-title').innerHTML = '<i class="fa-solid fa-key" style="color:var(--clay-orange);margin-right:8px;"></i>Edit License';
  openModal('license-modal');
}

document.getElementById('license-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('license-id').value;
  const body = {
    software_id: document.getElementById('license-software').value,
    license_key: document.getElementById('license-key').value,
    license_type: document.getElementById('license-type').value,
    total_seats: parseInt(document.getElementById('license-seats').value),
    cost_per_year: parseFloat(document.getElementById('license-cost').value),
    purchase_date: document.getElementById('license-purchase').value,
    renewal_date: document.getElementById('license-renewal').value,
    notes: document.getElementById('license-notes').value,
  };
  const method = id ? 'PUT' : 'POST';
  const path = id ? `/admin/licenses/${id}` : '/admin/licenses';
  const res = await api(method, path, body);
  if (!res) return;
  const data = await res.json();
  if (res.ok) { showToast(id ? 'License updated' : 'License added', 'success'); closeModal('license-modal'); loadLicenses(); }
  else showToast(data.error || 'Error saving license', 'error');
});

function populateAssignmentLicenseSelect() {
  const sel = document.getElementById('assignment-license');
  sel.innerHTML = '<option value="">-- Select License --</option>' + allLicenses.map(l => `<option value="${l.id}">${l.software_name} — ${l.license_type} (${l.total_seats} seats)</option>`).join('');
}

// ─── ASSIGNMENTS ─────────────────────────────────────────────────
let allAssignments = [];

async function loadAssignments() {
  if (!allClients.length) await loadClients();
  if (!allLicenses.length) await loadLicenses();

  const res = await api('GET', '/admin/assignments');
  if (!res) return;
  allAssignments = await res.json();
  const tbody = document.getElementById('assignments-body');

  if (!allAssignments.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-link"></i><p>No assignments yet.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = allAssignments.map(a => `
    <tr>
      <td><strong>${a.software_name}</strong><br><span class="text-muted">${a.vendor}</span></td>
      <td>${a.company_name}</td>
      <td>${a.seats_allocated}</td>
      <td>${formatDate(a.assigned_date)}</td>
      <td>${formatDate(a.renewal_date)}</td>
      <td>${statusBadge(a.license_status)}</td>
      <td>
        <button class="icon-btn delete" onclick="confirmDelete('assignment', ${a.id}, '${a.software_name} for ${a.company_name}')" title="Remove"><i class="fa-solid fa-unlink"></i></button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('assignment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    license_id: document.getElementById('assignment-license').value,
    client_id: document.getElementById('assignment-client').value,
    seats_allocated: parseInt(document.getElementById('assignment-seats').value),
    assigned_date: document.getElementById('assignment-date').value,
    notes: document.getElementById('assignment-notes').value,
  };
  const res = await api('POST', '/admin/assignments', body);
  if (!res) return;
  const data = await res.json();
  if (res.ok) { showToast('Assignment created', 'success'); closeModal('assignment-modal'); loadAssignments(); }
  else showToast(data.error || 'Error creating assignment', 'error');
});

// Set today's date in assignment form
document.getElementById('assignment-date').valueAsDate = new Date();

// ─── USERS ───────────────────────────────────────────────────────
async function loadUsers() {
  if (!allClients.length) await loadClients();
  const res = await api('GET', '/admin/users');
  if (!res) return;
  const users = await res.json();
  const tbody = document.getElementById('users-body');

  tbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.username}</strong></td>
      <td>${u.email}</td>
      <td><span class="badge badge-${u.role === 'admin' ? 'urgent' : 'active'}"><i class="fa-solid fa-${u.role === 'admin' ? 'shield-halved' : 'user'}"></i> ${u.role}</span></td>
      <td>${u.company_name || '—'}</td>
      <td><span class="badge badge-${u.is_active ? 'active' : 'expired'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
      <td class="text-muted">${formatDate(u.created_at)}</td>
      <td>
        ${u.role !== 'admin' ? `<button class="icon-btn delete" onclick="confirmDelete('user', ${u.id}, '${u.username}')" title="Delete"><i class="fa-solid fa-trash"></i></button>` : '<span class="text-muted text-sm">Protected</span>'}
      </td>
    </tr>
  `).join('');
}

document.getElementById('user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    username: document.getElementById('user-name').value,
    email: document.getElementById('user-email').value,
    password: document.getElementById('user-password').value,
    role: 'client',
    client_id: document.getElementById('user-client').value || null,
  };
  const res = await api('POST', '/admin/users', body);
  if (!res) return;
  const data = await res.json();
  if (res.ok) { showToast('User created', 'success'); closeModal('user-modal'); loadUsers(); }
  else showToast(data.error || 'Error creating user', 'error');
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────
async function loadNotifications() {
  const res = await api('GET', '/admin/notifications');
  if (!res) return;
  let notifs = await res.json();
  const typeFilter = document.getElementById('notif-type-filter').value;
  const readFilter = document.getElementById('notif-read-filter').value;

  if (typeFilter) notifs = notifs.filter(n => n.type === typeFilter);
  if (readFilter !== '') notifs = notifs.filter(n => String(n.is_read) === readFilter);

  const list = document.getElementById('notifications-list');
  if (!notifs.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><p>No notifications match the current filters.</p></div>`;
    return;
  }

  list.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}">
      ${notifIcon(n.type)}
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${dayjs(n.created_at).format('DD MMM YYYY, HH:mm')} ${n.company_name ? `&bull; ${n.company_name}` : ''}</div>
      </div>
      ${!n.is_read ? `<button class="clay-btn clay-btn-secondary clay-btn-sm" onclick="markRead(${n.id}); loadNotifications();"><i class="fa-solid fa-check"></i></button>` : '<span class="text-muted text-sm">Read</span>'}
    </div>
  `).join('');
}

// ─── MODAL UTILS ─────────────────────────────────────────────────
function openModal(id) {
  // Reset the form if opening fresh (no id value)
  const modal = document.getElementById(id);
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  // Reset hidden IDs & form
  const form = document.querySelector(`#${id} form`);
  if (form) {
    form.reset();
    const hiddenId = form.querySelector('input[type="hidden"]');
    if (hiddenId) hiddenId.value = '';
  }
  // Reset modal titles
  if (id === 'client-modal') document.getElementById('client-modal-title').innerHTML = '<i class="fa-solid fa-building" style="color:var(--clay-purple);margin-right:8px;"></i>Add Client';
  if (id === 'software-modal') document.getElementById('software-modal-title').innerHTML = '<i class="fa-solid fa-box" style="color:var(--clay-teal);margin-right:8px;"></i>Add Software';
  if (id === 'license-modal') document.getElementById('license-modal-title').innerHTML = '<i class="fa-solid fa-key" style="color:var(--clay-orange);margin-right:8px;"></i>Add License';
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ─── CONFIRM DELETE ───────────────────────────────────────────────
const deleteEndpoints = { client: '/admin/clients', software: '/admin/software', license: '/admin/licenses', assignment: '/admin/assignments', user: '/admin/users' };
const deleteReloaders = { client: loadClients, software: loadSoftware, license: loadLicenses, assignment: loadAssignments, user: loadUsers };

function confirmDelete(type, id, name) {
  document.getElementById('confirm-title').textContent = `Delete ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  document.getElementById('confirm-msg').textContent = `Are you sure you want to delete "${name}"? This action cannot be undone.`;
  document.getElementById('confirm-overlay').style.display = 'flex';
  document.getElementById('confirm-ok-btn').onclick = async () => {
    const res = await api('DELETE', `${deleteEndpoints[type]}/${id}`);
    closeConfirm();
    if (res && res.ok) {
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`, 'success');
      deleteReloaders[type]();
    } else {
      showToast('Error deleting item', 'error');
    }
  };
}

function closeConfirm() {
  document.getElementById('confirm-overlay').style.display = 'none';
}

// ─── TABLE FILTER ─────────────────────────────────────────────────
function filterTable(tbodyId, query) {
  const q = query.toLowerCase();
  document.querySelectorAll(`#${tbodyId} tr`).forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
