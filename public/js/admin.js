let adminToken = localStorage.getItem('amanahToken');
let adminUser  = JSON.parse(localStorage.getItem('amanahUser') || 'null');
let triggerMap, triggerMarkers = [], allUsersData = [];
const socket = io();

// ===== CHECK AUTH =====
window.addEventListener('DOMContentLoaded', () => {
  if (adminToken && adminUser?.role === 'admin') {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('adminName').textContent = adminUser.name;
    socket.emit('register-user', adminUser.id);
    initAdmin();
  }
  startClock();
  initSidebarTabs();
});

socket.on('online-count', c => { document.getElementById('sbOnline').textContent = c; });
socket.on('new-report',   () => { loadReports(); loadOverview(); });
socket.on('new-alert',    () => { loadOverview(); loadAllAlerts(); });

// ===== ADMIN LOGIN =====
async function adminLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const pass  = document.getElementById('adminPass').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok || data.user.role !== 'admin') throw new Error(data.error || 'Not an admin account');
    adminToken = data.token; adminUser = data.user;
    localStorage.setItem('amanahToken', adminToken);
    localStorage.setItem('amanahUser', JSON.stringify(adminUser));
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('adminName').textContent = adminUser.name;
    socket.emit('register-user', adminUser.id);
    initAdmin();
  } catch(err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
  }
}

function adminLogout() {
  localStorage.removeItem('amanahToken'); localStorage.removeItem('amanahUser');
  window.location.href = '/login';
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken };
}

// ===== INIT =====
function initAdmin() {
  loadOverview();
  loadAllAlerts();
  loadUsers();
  loadResources2();
  loadReports();
  initTriggerMap();
}

// ===== SIDEBAR TABS =====
function initSidebarTabs() {
  document.querySelectorAll('.sb-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const tab = link.dataset.tab;
      document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      link.classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
      document.getElementById('tabTitle').textContent = link.textContent.trim();
      if (tab === 'map') initAdminLiveMap();
    });
  });
}

// ===== CLOCK =====
function startClock() {
  const el = document.getElementById('topbarTime');
  setInterval(() => {
    el.textContent = new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' });
  }, 1000);
}

// ===== OVERVIEW =====
async function loadOverview() {
  try {
    const res  = await fetch('/api/alerts/stats/summary', { headers: authHeaders() });
    const data = await res.json();
    document.getElementById('sc-active').textContent   = data.active   || 0;
    document.getElementById('sc-total').textContent    = data.total    || 0;
    document.getElementById('sc-resolved').textContent = data.resolved || 0;
    document.getElementById('sc-users').textContent    = data.totalUsers || 0;
    renderSeverityChart(data.bySeverity || []);
    renderTypeChart(data.byType || []);
  } catch(e) {}
  loadRecentAlerts();
  loadPendingReports();
}

async function loadRecentAlerts() {
  try {
    const res  = await fetch('/api/alerts/all', { headers: authHeaders() });
    const { alerts } = await res.json();
    const sevColor = { critical:'#7c3aed', high:'#ef4444', medium:'#f97316', low:'#f59e0b' };
    const el = document.getElementById('recentAlerts');
    if (!alerts.length) { el.innerHTML = '<p style="color:var(--muted)">No alerts yet.</p>'; return; }
    el.innerHTML = alerts.slice(0,5).map(a => `
      <div class="ri-item">
        <div class="ri-dot" style="background:${sevColor[a.severity]}"></div>
        <div class="ri-title">${a.title}</div>
        <div class="ri-time">${new Date(a.createdAt).toLocaleDateString('en-IN')}</div>
      </div>`).join('');
  } catch(e) {}
}

function renderSeverityChart(data) {
  const el = document.getElementById('severityChart');
  const sevColor = { critical:'#7c3aed', high:'#ef4444', medium:'#f97316', low:'#f59e0b' };
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const order = ['critical','high','medium','low'];
  el.innerHTML = order.map(sev => {
    const item = data.find(d => d._id === sev) || { count: 0 };
    const pct  = Math.round((item.count / total) * 100);
    return `<div class="sbar-row">
      <div class="sbar-label" style="color:${sevColor[sev]}">${sev}</div>
      <div class="sbar-track"><div class="sbar-fill" style="width:${pct}%;background:${sevColor[sev]}"></div></div>
      <div class="sbar-count">${item.count}</div>
    </div>`;
  }).join('');
}

function renderTypeChart(data) {
  const el = document.getElementById('typeChart');
  const typEmoji = { flood:'🌊',earthquake:'🌍',cyclone:'🌀',fire:'🔥',tsunami:'🌊',landslide:'⛰️',drought:'☀️',epidemic:'🦠',industrial:'🏭',terrorist:'💣',nuclear:'☢️',chemical:'🧪',other:'⚠️' };
  el.innerHTML = data.slice(0,8).map(d => `
    <div class="tl-item">
      <span>${typEmoji[d._id]||'⚠️'} ${d._id}</span>
      <span class="tl-count">${d.count}</span>
    </div>`).join('') || '<p style="color:var(--muted)">No data</p>';
}

async function loadPendingReports() {
  try {
    const res  = await fetch('/api/reports', { headers: authHeaders() });
    const { reports } = await res.json();
    const pending = reports.filter(r => r.status === 'pending');
    const el = document.getElementById('pendingReports');
    if (!pending.length) { el.innerHTML = '<p style="color:var(--muted)">No pending reports.</p>'; return; }
    el.innerHTML = pending.slice(0,5).map(r => `
      <div class="ri-item">
        <div class="ri-dot" style="background:#f59e0b"></div>
        <div class="ri-title">${r.title}</div>
        <div class="ri-time">${r.location?.city||''}</div>
      </div>`).join('');
  } catch(e) {}
}

// ===== TRIGGER MAP =====
function initTriggerMap() {
  if (!document.getElementById('triggerMap') || triggerMap) return;
  triggerMap = L.map('triggerMap').setView([20.5937, 78.9629], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OSM' }).addTo(triggerMap);

  // Click on map to add a pin
  triggerMap.on('click', e => {
    const { lat, lng } = e.latlng;
    addMapPin(lat, lng);
  });
}

function addMapPin(lat, lng, cityVal = '', stateVal = '') {
  const index = triggerMarkers.length;

  const marker = L.marker([lat, lng], {
    draggable: true,
    icon: L.divIcon({
      html: `<div style="background:#ef4444;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:700">${index+1}</div>`,
      className: '', iconSize: [20,20], iconAnchor: [10,10]
    })
  }).addTo(triggerMap);

  // Update lat/lng inputs when dragged
  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    const row = document.querySelector(`.area-row[data-index="${index}"]`);
    if (row) {
      row.querySelector('.area-lat').value = pos.lat.toFixed(6);
      row.querySelector('.area-lng').value = pos.lng.toFixed(6);
    }
  });

  triggerMarkers.push(marker);
  addAreaRow(lat.toFixed(6), lng.toFixed(6), cityVal, stateVal, index);
}

function removePin(index) {
  if (triggerMarkers[index]) {
    triggerMap.removeLayer(triggerMarkers[index]);
    triggerMarkers.splice(index, 1);
  }
  const row = document.querySelector(`.area-row[data-index="${index}"]`);
  if (row) row.remove();
  // Re-index remaining rows
  document.querySelectorAll('.area-row').forEach((row, i) => {
    row.dataset.index = i;
  });
}

function addAreaRow(lat = '', lng = '', city = '', state = '', index = null) {
  const container = document.getElementById('areasContainer');
  const idx = index !== null ? index : container.children.length;
  const div = document.createElement('div');
  div.className = 'area-row';
  div.dataset.index = idx;
  div.innerHTML = `
    <div class="area-row-inner">
      <div class="area-fields">
        <input type="text"   placeholder="City"         class="area-city"   value="${city}"/>
        <input type="text"   placeholder="State"        class="area-state"  value="${state}"/>
        <input type="number" placeholder="Radius (km)"  class="area-radius" value="50"/>
        <input type="number" placeholder="Latitude"     class="area-lat"    value="${lat}" step="any"/>
        <input type="number" placeholder="Longitude"    class="area-lng"    value="${lng}" step="any"/>
      </div>
      <button type="button" class="btn-remove-pin" onclick="removePin(${idx})">✕ Remove</button>
    </div>`;

  // When lat/lng typed manually, move marker on map
  div.querySelector('.area-lat').addEventListener('change', () => updateMarkerFromInput(idx));
  div.querySelector('.area-lng').addEventListener('change', () => updateMarkerFromInput(idx));

  container.appendChild(div);
}

function updateMarkerFromInput(index) {
  const row = document.querySelector(`.area-row[data-index="${index}"]`);
  if (!row) return;
  const lat = parseFloat(row.querySelector('.area-lat').value);
  const lng = parseFloat(row.querySelector('.area-lng').value);
  if (isNaN(lat) || isNaN(lng)) return;
  if (triggerMarkers[index]) {
    triggerMarkers[index].setLatLng([lat, lng]);
    triggerMap.panTo([lat, lng]);
  } else {
    const marker = L.marker([lat, lng], { draggable: true,
      icon: L.divIcon({
        html: `<div style="background:#ef4444;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:700">${index+1}</div>`,
        className: '', iconSize:[20,20], iconAnchor:[10,10]
      })
    }).addTo(triggerMap);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      row.querySelector('.area-lat').value = pos.lat.toFixed(6);
      row.querySelector('.area-lng').value = pos.lng.toFixed(6);
    });
    triggerMarkers[index] = marker;
    triggerMap.panTo([lat, lng]);
  }
}

function addManualAreaRow() {
  addAreaRow('', '', '', '', triggerMarkers.length);
}

// ===== TRIGGER ALERT =====
async function triggerAlert() {
  const title       = document.getElementById('aTitle').value.trim();
  const type        = document.getElementById('aType').value;
  const severity    = document.getElementById('aSeverity').value;
  const description = document.getElementById('aDesc').value.trim();
  const instrText   = document.getElementById('aInstructions').value;
  const helplinesText = document.getElementById('aHelplines').value;
  const resultEl    = document.getElementById('triggerResult');

  if (!title || !type || !severity || !description) {
    resultEl.className = 'trigger-result error';
    resultEl.textContent = '⚠️ Please fill in Title, Type, Severity and Description.';
    resultEl.style.display = 'block'; return;
  }

  // Collect affected areas from rows
  const rows = document.querySelectorAll('#areasContainer .area-row');
  const affectedAreas = [...rows].map(row => ({
    city:   row.querySelector('.area-city')?.value.trim() || '',
    state:  row.querySelector('.area-state')?.value.trim() || '',
    radius: parseInt(row.querySelector('.area-radius')?.value) || 50,
    lat:    parseFloat(row.querySelector('.area-lat')?.value) || 0,
    lng:    parseFloat(row.querySelector('.area-lng')?.value) || 0,
  })).filter(a => a.city || a.state || a.lat);

  const instructions    = instrText.split('\n').map(s => s.trim()).filter(Boolean);
  const helplineNumbers = helplinesText.split(',').map(s => s.trim()).filter(Boolean);

  const btn = document.getElementById('triggerBtn');
  btn.textContent = '⏳ Triggering & Notifying Users...'; btn.disabled = true;

  try {
    const res = await fetch('/api/alerts/trigger', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ title, type, severity, description, affectedAreas, instructions, helplineNumbers })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    resultEl.className = 'trigger-result success';
    resultEl.innerHTML = `✅ Alert triggered! <strong>${data.affectedUsersCount}</strong> users are being notified via Email, SMS & Push.`;
    resultEl.style.display = 'block';

    // Reset form
    document.getElementById('aTitle').value = '';
    document.getElementById('aType').value  = '';
    document.getElementById('aSeverity').value = '';
    document.getElementById('aDesc').value  = '';
    document.getElementById('aInstructions').value = '';
    document.getElementById('aHelplines').value = '';
    document.getElementById('areasContainer').innerHTML = '';
    triggerMarkers.forEach(m => triggerMap.removeLayer(m));
    triggerMarkers = [];

    loadOverview(); loadAllAlerts();
  } catch(err) {
    resultEl.className = 'trigger-result error';
    resultEl.textContent = '❌ Error: ' + err.message;
    resultEl.style.display = 'block';
  }
  btn.textContent = '🚨 TRIGGER ALERT & NOTIFY USERS'; btn.disabled = false;
}

// ===== MANAGE ALERTS =====
async function loadAllAlerts() {
  try {
    const status = document.getElementById('statusFilter')?.value || '';
    const res    = await fetch('/api/alerts/all', { headers: authHeaders() });
    let { alerts } = await res.json();
    if (status) alerts = alerts.filter(a => a.status === status);
    const el = document.getElementById('allAlertsList');
    if (!alerts.length) { el.innerHTML = '<p style="color:var(--muted);padding:20px">No alerts found.</p>'; return; }
    const typEmoji = { flood:'🌊',earthquake:'🌍',cyclone:'🌀',fire:'🔥',tsunami:'🌊',landslide:'⛰️',drought:'☀️',epidemic:'🦠',industrial:'🏭',terrorist:'💣',nuclear:'☢️',chemical:'🧪',other:'⚠️' };
    el.innerHTML = alerts.map(a => `
      <div class="al-item">
        <div class="al-icon">${typEmoji[a.type]||'⚠️'}</div>
        <div class="al-body">
          <div class="al-title">${a.title}</div>
          <div class="al-sub">
            ${a.affectedAreas.map(x=>`📍${x.city||''}`).join(' ')} ·
            Notified: ${a.notifiedCount} users ·
            ${new Date(a.createdAt).toLocaleString('en-IN')}
          </div>
        </div>
        <div class="al-actions">
          <span class="al-badge ${a.severity}">${a.severity}</span>
          <span class="al-badge ${a.status}">${a.status}</span>
          ${a.status !== 'resolved' ? `<button class="btn-xs resolve" onclick="updateAlertStatus('${a._id}','resolved')">✅ Resolve</button>` : ''}
          ${a.status === 'active'   ? `<button class="btn-xs monitor" onclick="updateAlertStatus('${a._id}','monitoring')">👁 Monitor</button>` : ''}
          <button class="btn-xs delete" onclick="deleteAlert('${a._id}')">🗑 Delete</button>
        </div>
      </div>`).join('');
  } catch(e) {}
}

async function updateAlertStatus(id, status) {
  await fetch(`/api/alerts/${id}/status`, {
    method:'PATCH', headers: authHeaders(), body: JSON.stringify({ status })
  });
  loadAllAlerts(); loadOverview();
}

async function deleteAlert(id) {
  if (!confirm('Delete this alert? This cannot be undone.')) return;
  await fetch(`/api/alerts/${id}`, { method:'DELETE', headers: authHeaders() });
  loadAllAlerts(); loadOverview();
}

// ===== USERS =====
async function loadUsers() {
  try {
    const res  = await fetch('/api/users', { headers: authHeaders() });
    const { users } = await res.json();
    allUsersData = users;
    renderUsersTable(users);
  } catch(e) {}
}

function filterUsers() {
  const q = document.getElementById('userSearch').value.toLowerCase();
  renderUsersTable(allUsersData.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    u.location?.city?.toLowerCase().includes(q)
  ));
}

function renderUsersTable(users) {
  const el = document.getElementById('usersList');
  if (!users.length) { el.innerHTML = '<p style="color:var(--muted);padding:20px">No users found.</p>'; return; }
  el.innerHTML = `<table>
    <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Location</th><th>Push</th><th>Joined</th></tr></thead>
    <tbody>${users.map((u,i) => `
      <tr>
        <td style="color:var(--muted)">${i+1}</td>
        <td style="font-weight:600">${u.name}</td>
        <td style="color:var(--muted)">${u.email}</td>
        <td>${u.phone}</td>
        <td>📍 ${u.location?.city||''}, ${u.location?.state||''}</td>
        <td>${u.pushSubscription ? '✅' : '❌'}</td>
        <td style="color:var(--muted)">${new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
      </tr>`).join('')}
    </tbody></table>`;
}

// ===== RESOURCES =====
async function loadResources2() {
  try {
    const res  = await fetch('/api/resources', { headers: authHeaders() });
    const { resources } = await res.json();
    const icons = { hospital:'🏥', shelter:'🏠', food:'🍱', rescue:'🚁', police:'👮', fire_station:'🚒' };
    const el = document.getElementById('resourcesList2');
    if (!resources.length) { el.innerHTML = '<p style="color:var(--muted);padding:20px">No resources. Add some!</p>'; return; }
    el.innerHTML = resources.map(r => `
      <div class="al-item">
        <div class="al-icon">${icons[r.type]||'📍'}</div>
        <div class="al-body">
          <div class="al-title">${r.name}</div>
          <div class="al-sub">${r.address}, ${r.city}, ${r.state} · ${r.phone||'No phone'} · Capacity: ${r.capacity||'N/A'}</div>
        </div>
        <div class="al-actions">
          <span class="al-badge ${r.available?'resolved':'active'}">${r.available?'Available':'Unavailable'}</span>
          <button class="btn-xs ${r.available?'monitor':'resolve'}" onclick="toggleResource('${r._id}',${!r.available})">${r.available?'Mark Full':'Mark Available'}</button>
        </div>
      </div>`).join('');
  } catch(e) {}
}

function showAddResource() {
  const f = document.getElementById('addResourceForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

async function addResource() {
  const body = {
    name: document.getElementById('rName').value, type: document.getElementById('rType').value,
    address: document.getElementById('rAddress').value, city: document.getElementById('rCity').value,
    state: document.getElementById('rState').value, phone: document.getElementById('rPhone').value,
    capacity: parseInt(document.getElementById('rCapacity').value)||0,
    lat: parseFloat(document.getElementById('rLat').value)||0,
    lng: parseFloat(document.getElementById('rLng').value)||0
  };
  await fetch('/api/resources', { method:'POST', headers: authHeaders(), body: JSON.stringify(body) });
  document.getElementById('addResourceForm').style.display = 'none';
  loadResources2();
}

async function toggleResource(id, available) {
  await fetch(`/api/resources/${id}`, { method:'PATCH', headers: authHeaders(), body: JSON.stringify({ available }) });
  loadResources2();
}

// ===== REPORTS =====
async function loadReports() {
  try {
    const res  = await fetch('/api/reports', { headers: authHeaders() });
    const { reports } = await res.json();
    const el = document.getElementById('reportsList');
    if (!reports.length) { el.innerHTML = '<p style="color:var(--muted);padding:20px">No reports yet.</p>'; return; }
    el.innerHTML = reports.map(r => `
      <div class="al-item">
        <div class="al-icon">📝</div>
        <div class="al-body">
          <div class="al-title">${r.title}</div>
          <div class="al-sub">${r.type} · 📍 ${r.location?.city||''}, ${r.location?.state||''} · By: ${r.reportedBy?.name||'Unknown'} · ${new Date(r.createdAt).toLocaleString('en-IN')}</div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px">${r.description?.substring(0,120)||''}</div>
        </div>
        <div class="al-actions">
          <span class="al-badge ${r.status}">${r.status}</span>
          ${r.status==='pending' ? `<button class="btn-xs verify" onclick="updateReport('${r._id}','verified')">✅ Verify</button>` : ''}
          ${r.status!=='dismissed' ? `<button class="btn-xs dismiss" onclick="updateReport('${r._id}','dismissed')">✕ Dismiss</button>` : ''}
        </div>
      </div>`).join('');
  } catch(e) {}
}

async function updateReport(id, status) {
  await fetch(`/api/reports/${id}`, { method:'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) });
  loadReports(); loadOverview();
}

// ===== ADMIN LIVE MAP =====
let adminMap = null;
function initAdminLiveMap() {
  if (adminMap) return;
  adminMap = L.map('adminLiveMap').setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution:'© OSM © CARTO' }).addTo(adminMap);
  fetch('/api/alerts/all', { headers: authHeaders() }).then(r => r.json()).then(({ alerts }) => {
    const sevColor = { critical:'#7c3aed', high:'#ef4444', medium:'#f97316', low:'#f59e0b' };
    alerts.filter(a => a.status === 'active').forEach(a => {
      (a.affectedAreas||[]).forEach(area => {
        if (!area.lat || !area.lng) return;
        const c = sevColor[a.severity] || '#ef4444';
        L.circle([area.lat, area.lng], { color:c, fillColor:c, fillOpacity:.2, radius:(area.radius||50)*1000 }).addTo(adminMap);
        L.circleMarker([area.lat, area.lng], { radius:10, color:c, fillColor:c, fillOpacity:.8 })
          .addTo(adminMap).bindPopup(`<b>${a.title}</b><br>${a.severity.toUpperCase()}`);
      });
    });
  });
  fetch('/api/resources').then(r => r.json()).then(({ resources }) => {
    resources.forEach(r => {
      if (r.lat && r.lng) {
        L.circleMarker([r.lat, r.lng], { radius:7, color:'#22c55e', fillColor:'#22c55e', fillOpacity:.9 })
          .addTo(adminMap).bindPopup(`<b>${r.name}</b><br>${r.city}`);
      }
    });
  });
  socket.on('new-alert', ({ alert }) => {
    const c = { critical:'#7c3aed', high:'#ef4444', medium:'#f97316', low:'#f59e0b' }[alert.severity] || '#ef4444';
    (alert.affectedAreas||[]).forEach(area => {
      if (area.lat && area.lng) {
        L.circle([area.lat, area.lng], { color:c, fillColor:c, fillOpacity:.2, radius:(area.radius||50)*1000 }).addTo(adminMap);
        adminMap.flyTo([area.lat, area.lng], 8, { duration:2 });
      }
    });
  });
}

document.getElementById('adminPass')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') adminLogin();
});