// ─── STATE ─────────────────────────────────────────────────────
let token = localStorage.getItem('nyeri_token');
let currentUser = JSON.parse(localStorage.getItem('nyeri_user') || 'null');
let dashData = null;
let categoryChart, timelineChart;

// ─── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!token || !currentUser || currentUser.role !== 'client') {
    window.location.href = '/';
    return;
  }
  updateClientThemeLabel();
  loadClientDashboard();
});

// ─── HELPERS ────────────────────────────────────────────────────
function updateClientThemeLabel() {
  const theme = ThemeManager.getTheme();
  const label = document.getElementById('client-theme-label');
  if (label) label.textContent = theme === 'dark' ? 'Dark' : 'Light';
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  if (res.status === 401 || res.status === 403) { logout(); return null; }
  return res;
}

function logout() {
  localStorage.removeItem('nyeri_token');
  localStorage.removeItem('nyeri_user');
  window.location.href = '/';
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

function formatDate(d) { return d ? dayjs(d).format('DD MMM YYYY') : '—'; }
function formatCost(n) { return n ? `KES ${Number(n).toLocaleString()}` : 'KES 0'; }

function statusBadge(status) {
  const labels = { active: 'Active', expiring_soon: 'Expiring Soon', urgent: 'Urgent', expired: 'Expired', inactive: 'Inactive' };
  const icons = { active: 'fa-circle-check', expiring_soon: 'fa-clock', urgent: 'fa-triangle-exclamation', expired: 'fa-circle-xmark', inactive: 'fa-circle-minus' };
  return `<span class="badge badge-${status}"><i class="fa-solid ${icons[status] || 'fa-circle'}"></i> ${labels[status] || status}</span>`;
}

function notifIcon(type) {
  const map = { urgent: 'fa-fire', warning: 'fa-triangle-exclamation', expired: 'fa-circle-xmark', info: 'fa-circle-info', success: 'fa-circle-check' };
  return `<div class="notif-icon ${type}"><i class="fa-solid ${map[type] || 'fa-bell'}"></i></div>`;
}

// ─── VIEW SWITCHING ─────────────────────────────────────────────
function switchClientView(view, el) {
  document.querySelectorAll('.client-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.client-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`client-view-${view}`).classList.add('active');
  if (el) el.classList.add('active');

  if (view === 'notifications') loadClientNotifications();
  if (view === 'licenses' && dashData) renderLicensesTable(dashData.licenses);
}

// ─── DASHBOARD LOAD ─────────────────────────────────────────────
async function loadClientDashboard() {
  const res = await api('GET', '/client/dashboard');
  if (!res) return;
  dashData = await res.json();

  // Populate header
  document.getElementById('client-company-name').textContent = dashData.client.company_name;
  document.getElementById('welcome-name').textContent = currentUser.username.split(' ')[0];

  // Welcome stats
  document.getElementById('ws-active').textContent = dashData.activeLicenses;
  document.getElementById('ws-expiring').textContent = dashData.expiring;
  document.getElementById('ws-expired').textContent = dashData.expired;
  document.getElementById('ws-cost').textContent = `KES ${Number(dashData.totalCost).toLocaleString()}`;

  // KPI Cards
  const kpiData = [
    { label: 'Total Services', value: dashData.licenses.length, icon: 'fa-box', color: 'purple' },
    { label: 'Active Licenses', value: dashData.activeLicenses, icon: 'fa-circle-check', color: 'green' },
    { label: 'Expiring Soon', value: dashData.expiring, icon: 'fa-clock', color: 'orange' },
    { label: 'Expired', value: dashData.expired, icon: 'fa-circle-xmark', color: 'red' },
  ];

  document.getElementById('client-kpi-grid').innerHTML = kpiData.map(k => `
    <div class="kpi-card ${k.color}">
      <div class="kpi-icon ${k.color}"><i class="fa-solid ${k.icon}"></i></div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
    </div>
  `).join('');

  // Update notification badge
  if (dashData.unreadNotifs > 0) {
    const badge = document.getElementById('client-notif-badge');
    badge.textContent = dashData.unreadNotifs;
    badge.style.display = 'inline-flex';
  }

  // Charts
  renderClientCharts(dashData);

  // Services grid
  renderServicesGrid(dashData.licenses);
}

// ─── CLIENT CHARTS ───────────────────────────────────────────────
function renderClientCharts(d) {
  const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || 'rgba(0,0,0,0.08)';
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#666';
  const palette = ['#7c5cbf','#e05c8a','#2bbfa0','#f07a3a','#3a86d4','#f5c842','#e04040','#3ab86e'];

  // Category Pie
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(document.getElementById('client-chart-category'), {
    type: 'pie',
    data: {
      labels: d.categoryBreakdown.map(c => c.category),
      datasets: [{ data: d.categoryBreakdown.map(c => c.count), backgroundColor: palette.slice(0, d.categoryBreakdown.length), borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, padding: 12, color: textColor } } }
    }
  });

  // Renewal Timeline — bar showing days left per license
  const expiring = d.licenses.filter(l => l.renewal_date).sort((a, b) => a.days_left - b.days_left).slice(0, 8);
  const barColors = expiring.map(l => {
    if (l.days_left < 0) return '#e04040';
    if (l.days_left <= 7) return '#f07a3a';
    if (l.days_left <= 30) return '#f5c842';
    return '#3ab86e';
  });

  if (timelineChart) timelineChart.destroy();
  timelineChart = new Chart(document.getElementById('client-chart-timeline'), {
    type: 'bar',
    data: {
      labels: expiring.map(l => l.software_name.length > 14 ? l.software_name.substring(0, 14) + '…' : l.software_name),
      datasets: [{ label: 'Days Until Renewal', data: expiring.map(l => Math.max(l.days_left, 0)), backgroundColor: barColors, borderRadius: 8, borderSkipped: false }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor }, title: { display: true, text: 'Days', color: textColor } },
        x: { grid: { display: false }, ticks: { color: textColor, maxRotation: 30 } }
      }
    }
  });
}

// ─── SERVICES GRID ────────────────────────────────────────────────
const categoryIcons = { Productivity: 'fa-file-word', Security: 'fa-shield-halved', Design: 'fa-pen-nib', Accounting: 'fa-calculator', Communication: 'fa-comments', Engineering: 'fa-drafting-compass', Development: 'fa-code', Analytics: 'fa-chart-line' };
const colorPalette = ['purple','pink','teal','orange','blue','green','yellow','red'];
const colorBgs = { purple: 'rgba(124,92,191,0.12)', pink: 'rgba(224,92,138,0.12)', teal: 'rgba(43,191,160,0.12)', orange: 'rgba(240,122,58,0.12)', blue: 'rgba(58,134,212,0.12)', green: 'rgba(58,184,110,0.12)', yellow: 'rgba(245,200,66,0.12)', red: 'rgba(224,64,64,0.12)' };
const colorFgs = { purple: '#7c5cbf', pink: '#e05c8a', teal: '#2bbfa0', orange: '#f07a3a', blue: '#3a86d4', green: '#3ab86e', yellow: '#c9a000', red: '#e04040' };

function getRenewalBarClass(days_left) {
  if (days_left < 0) return 'expired';
  if (days_left <= 7) return 'urgent';
  if (days_left <= 30) return 'expiring';
  return 'safe';
}

function getRenewalBarWidth(days_left, renewalDate) {
  if (!renewalDate || days_left < 0) return 100;
  const totalDays = 365;
  const pct = Math.min(100, Math.max(5, (days_left / totalDays) * 100));
  return pct;
}

function renderServicesGrid(licenses) {
  const grid = document.getElementById('services-grid');
  if (!licenses.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="fa-solid fa-box-open"></i><p>No services assigned yet. Contact Nyeri IT Solutions.</p></div>`;
    return;
  }

  grid.innerHTML = licenses.map((l, i) => {
    const col = colorPalette[i % colorPalette.length];
    const icon = categoryIcons[l.category] || 'fa-box';
    const barClass = getRenewalBarClass(l.days_left);
    const barWidth = getRenewalBarWidth(l.days_left, l.renewal_date);

    return `
    <div class="service-card">
      <div class="service-card-header">
        <div>
          <div class="service-icon" style="background:${colorBgs[col]};color:${colorFgs[col]};"><i class="fa-solid ${icon}"></i></div>
        </div>
        <div style="flex:1;">
          <div class="service-name">${l.software_name}</div>
          <div class="service-vendor">${l.vendor}</div>
        </div>
        ${statusBadge(l.status)}
      </div>
      <div class="service-card-body">
        <div class="service-detail"><i class="fa-solid fa-tag"></i> ${l.category}</div>
        <div class="service-detail"><i class="fa-solid fa-chair"></i> ${l.seats_allocated} seat${l.seats_allocated !== 1 ? 's' : ''} allocated</div>
        <div class="service-detail"><i class="fa-solid fa-money-bill-wave"></i> ${formatCost(l.cost_per_year)} / year</div>
        ${l.renewal_date ? `<div class="service-detail"><i class="fa-solid fa-calendar-day"></i> Renews ${formatDate(l.renewal_date)}</div>` : ''}
        ${l.renewal_date ? `
        <div class="renewal-bar-wrap">
          <div class="renewal-bar-label">
            <span>Renewal Progress</span>
            <span>${l.days_left < 0 ? 'Expired' : `${l.days_left} days left`}</span>
          </div>
          <div class="renewal-bar-track">
            <div class="renewal-bar-fill ${barClass}" style="width:${barWidth}%"></div>
          </div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ─── LICENSES TABLE ───────────────────────────────────────────────
function renderLicensesTable(licenses) {
  const tbody = document.getElementById('client-licenses-body');
  if (!licenses.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fa-solid fa-key"></i><p>No licenses assigned to your account.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = licenses.map(l => `
    <tr>
      <td><strong>${l.software_name}</strong></td>
      <td>${l.vendor}</td>
      <td><span class="badge badge-inactive">${l.category}</span></td>
      <td><span class="badge badge-inactive" style="text-transform:capitalize;">${l.license_type}</span></td>
      <td>${l.seats_allocated} / ${l.total_seats}</td>
      <td>${formatCost(l.cost_per_year)}</td>
      <td>${formatDate(l.renewal_date)}</td>
      <td>${l.renewal_date ? (l.days_left < 0 ? '<span class="days-pill expired"><i class="fa-solid fa-circle-xmark"></i> Expired</span>' : `<span class="days-pill ${l.days_left <= 7 ? 'urgent' : l.days_left <= 30 ? 'expiring' : 'safe'}">${l.days_left}d</span>`) : '—'}</td>
      <td>${statusBadge(l.status)}</td>
    </tr>
  `).join('');
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────
async function loadClientNotifications() {
  const res = await api('GET', '/client/notifications');
  if (!res) return;
  const notifs = await res.json();

  // Update badge
  const unread = notifs.filter(n => !n.is_read).length;
  const badge = document.getElementById('client-notif-badge');
  if (unread > 0) { badge.textContent = unread; badge.style.display = 'inline-flex'; }
  else badge.style.display = 'none';

  const list = document.getElementById('client-notifications-list');
  if (!notifs.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><p>No notifications at this time. You are all caught up.</p></div>`;
    return;
  }

  list.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}">
      ${notifIcon(n.type)}
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${dayjs(n.created_at).format('DD MMM YYYY, HH:mm')}</div>
      </div>
      ${!n.is_read ? `<button class="clay-btn clay-btn-secondary clay-btn-sm" onclick="markClientNotifRead(${n.id}, this)"><i class="fa-solid fa-check"></i></button>` : '<span class="text-muted text-sm">Read</span>'}
    </div>
  `).join('');
}

async function markClientNotifRead(id, btn) {
  await api('PUT', `/client/notifications/${id}/read`);
  btn.closest('.notif-item').classList.remove('unread');
  btn.replaceWith('<span class="text-muted text-sm">Read</span>');
  loadClientNotifications();
}

async function clientMarkAllRead() {
  await api('PUT', '/client/notifications/read-all');
  showToast('All notifications marked as read', 'success');
  loadClientNotifications();
}

// ─── TABLE FILTER ─────────────────────────────────────────────────
function filterTable(tbodyId, query) {
  const q = query.toLowerCase();
  document.querySelectorAll(`#${tbodyId} tr`).forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
