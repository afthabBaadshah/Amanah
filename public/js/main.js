const socket = io();
let allAlerts = [];
let resourceMap = null;
let resourceMarkers = [];

// ===== AUTH STATE =====
const token = localStorage.getItem('amanahToken');
const user  = JSON.parse(localStorage.getItem('amanahUser') || 'null');

if (token && user) {
  const navAuth = document.getElementById('navAuth');
  const navUser = document.getElementById('navUser');
  if (navAuth) navAuth.style.display = 'none';
  if (navUser) navUser.style.display = 'flex';
  socket.emit('register-user', user.id);
}

function logout() {
  localStorage.removeItem('amanahToken');
  localStorage.removeItem('amanahUser');
  window.location.href = '/';
}

// ===== NAV SCROLL — fix color on white sections =====
const nav = document.getElementById('nav');
function updateNav() {
  if (window.scrollY > 40) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}
window.addEventListener('scroll', updateNav);
updateNav();

// ===== SOCKET EVENTS =====
socket.on('new-alert', ({ alert }) => {
  showToast(alert);
  loadAlerts();
  updateTicker();
});
socket.on('alert-updated', () => loadAlerts());
socket.on('online-count', (count) => {
  const el = document.getElementById('onlineCount');
  if (el) el.textContent = count;
});

// ===== REVEAL ON SCROLL =====
const ro = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), parseInt(e.target.dataset.delay || 0));
      ro.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => ro.observe(el));

// ===== LOAD STATS =====
async function loadStats() {
  try {
    const res = await fetch('/api/alerts/stats/summary');
    const data = await res.json();
    const sa = document.getElementById('statAlerts');
    const su = document.getElementById('statUsers');
    const sr = document.getElementById('statResolved');
    if (sa) sa.textContent = data.active   || 0;
    if (su) su.textContent = data.totalUsers || 0;
    if (sr) sr.textContent = data.resolved || 0;
  } catch(e) { console.error('Stats error:', e); }
}

// ===== LOAD ALERTS =====
async function loadAlerts() {
  try {
    const res = await fetch('/api/alerts');
    const data = await res.json();
    allAlerts = data.alerts || [];
    renderAlerts(allAlerts);
    updateTicker();
  } catch(e) {
    const grid = document.getElementById('alertsGrid');
    if (grid) grid.innerHTML = '<div class="no-alerts">Could not load alerts. Make sure server is running.</div>';
  }
}

const severityEmoji = { critical:'🚨', high:'🔴', medium:'🟠', low:'🟡' };
const typeEmoji = {
  flood:'🌊', earthquake:'🌍', cyclone:'🌀', fire:'🔥',
  tsunami:'🌊', landslide:'⛰️', drought:'☀️', epidemic:'🦠',
  industrial:'🏭', terrorist:'💣', nuclear:'☢️', chemical:'🧪', other:'⚠️'
};

function renderAlerts(alerts) {
  const grid = document.getElementById('alertsGrid');
  if (!grid) return;
  if (!alerts.length) {
    grid.innerHTML = '<div class="no-alerts">✅ No active alerts right now. Stay prepared.</div>';
    return;
  }
  grid.innerHTML = alerts.map(a => `
    <div class="alert-card ${a.severity}" data-severity="${a.severity}">
      <div class="ac-top">
        <div class="ac-type">${typeEmoji[a.type] || '⚠️'}</div>
        <div class="ac-severity ${a.severity}">${severityEmoji[a.severity]} ${a.severity}</div>
      </div>
      <div class="ac-title">${a.title}</div>
      <div class="ac-desc">${a.description.substring(0,120)}${a.description.length > 120 ? '...' : ''}</div>
      <div class="ac-areas">${(a.affectedAreas||[]).map(x => `<span class="ac-area">📍 ${x.city||''}, ${x.state||''}</span>`).join('')}</div>
      ${a.instructions?.length ? `<div style="font-size:12px;color:#6b7a99;margin-bottom:12px">⚠️ ${a.instructions[0]}</div>` : ''}
      <div class="ac-footer">
        <div class="ac-status ${a.status}">● ${a.status}</div>
        <div>${new Date(a.createdAt).toLocaleDateString('en-IN')}</div>
      </div>
    </div>`).join('');
}

// ===== FILTER BUTTONS =====
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    const f = this.dataset.filter;
    renderAlerts(f === 'all' ? allAlerts : allAlerts.filter(a => a.severity === f));
  });
});

// ===== TICKER =====
function updateTicker() {
  const track = document.getElementById('tickerTrack');
  if (!track) return;
  if (!allAlerts.length) {
    track.innerHTML = '<span class="ticker-item">No active alerts — Stay prepared</span>';
    return;
  }
  track.innerHTML = `<span class="ticker-item">${allAlerts.map(a =>
    `${severityEmoji[a.severity]} ${a.title} — ${(a.affectedAreas[0]?.city || '') + ', ' + (a.affectedAreas[0]?.state || '')}`
  ).join('   |   ')}</span>`;
}

// ===== HERO MAP =====
function initHeroMap() {
  const el = document.getElementById('heroMap');
  if (!el) return;
  try {
    const map = L.map('heroMap', { zoomControl: false, scrollWheelZoom: false }).setView([20.5937, 78.9629], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OSM © CARTO'
    }).addTo(map);
    allAlerts.forEach(a => {
      (a.affectedAreas || []).forEach(area => {
        if (area.lat && area.lng) {
          const color = { critical:'#7c3aed', high:'#ef4444', medium:'#f97316', low:'#f59e0b' }[a.severity] || '#ef4444';
          L.circleMarker([area.lat, area.lng], {
            radius: 14, color, fillColor: color, fillOpacity: .35, weight: 2
          }).addTo(map).bindPopup(`<b>${a.title}</b><br>${area.city}, ${area.state}`);
        }
      });
    });
  } catch(e) { console.error('Hero map error:', e); }
}

// ===== RESOURCE MAP & SEARCH =====
function initResourceMap() {
  const el = document.getElementById('resourceMap');
  if (!el || resourceMap) return;
  try {
    resourceMap = L.map('resourceMap').setView([20.5937, 78.9629], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM'
    }).addTo(resourceMap);
  } catch(e) { console.error('Resource map error:', e); }
}

const resTypeIcon = { hospital:'🏥', shelter:'🏠', food:'🍱', rescue:'🚁', police:'👮', fire_station:'🚒' };

async function searchResources() {
  const cityEl = document.getElementById('resCity');
  const typeEl = document.getElementById('resType');
  const city = cityEl?.value || '';
  const type = typeEl?.value || '';
  const params = new URLSearchParams();
  if (city) params.append('city', city);
  if (type) params.append('type', type);
  try {
    const res = await fetch('/api/resources?' + params);
    const { resources } = await res.json();
    renderResources(resources);
  } catch(e) { console.error('Resources error:', e); }
}

function renderResources(resources) {
  const list = document.getElementById('resourcesList');
  if (!list) return;
  if (!resources || !resources.length) {
    list.innerHTML = '<p style="color:var(--muted)">No resources found. Try a different city.</p>';
    return;
  }
  list.innerHTML = resources.map(r => `
    <div class="res-card">
      <div class="res-top">
        <div class="res-icon">${resTypeIcon[r.type] || '📍'}</div>
        <div>
          <div class="res-name">${r.name}</div>
          <div class="res-type">${r.type.replace('_', ' ')}</div>
        </div>
      </div>
      <div class="res-addr">📍 ${r.address}, ${r.city}, ${r.state}</div>
      ${r.phone ? `<div class="res-phone">📞 ${r.phone}</div>` : ''}
      ${r.capacity ? `<div style="font-size:12px;color:var(--muted);margin-top:6px">Capacity: ${r.capacity}</div>` : ''}
    </div>`).join('');

  // Update map markers
  if (resourceMap) {
    resourceMarkers.forEach(m => resourceMap.removeLayer(m));
    resourceMarkers = [];
    const first = resources.find(r => r.lat && r.lng);
    if (first) resourceMap.setView([first.lat, first.lng], 11);
    resources.forEach(r => {
      if (r.lat && r.lng) {
        const m = L.marker([r.lat, r.lng]).addTo(resourceMap)
          .bindPopup(`<b>${resTypeIcon[r.type] || '📍'} ${r.name}</b><br>${r.address}<br><b>${r.phone || ''}</b>`);
        resourceMarkers.push(m);
      }
    });
  }
}

// ===== REPORT INCIDENT =====
async function submitReport() {
  if (!token) { alert('Please login to submit a report.'); return; }
  const title = document.getElementById('repTitle')?.value.trim();
  const type  = document.getElementById('repType')?.value;
  const city  = document.getElementById('repCity')?.value.trim();
  const state = document.getElementById('repState')?.value.trim();
  const desc  = document.getElementById('repDesc')?.value.trim();

  if (!title || !type || !city || !state || !desc) {
    alert('Please fill all fields.'); return;
  }

  const btn = document.getElementById('repBtn');
  btn.textContent = 'Submitting...'; btn.disabled = true;

  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ title, type, city, state, description: desc })
    });
    if (res.ok) {
      const successEl = document.getElementById('repSuccess');
      if (successEl) successEl.style.display = 'block';
      btn.style.display = 'none';
      ['repTitle','repType','repCity','repState','repDesc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    } else {
      const d = await res.json();
      alert(d.error || 'Submit failed');
      btn.textContent = 'Submit Report'; btn.disabled = false;
    }
  } catch(e) {
    alert('Network error'); btn.textContent = 'Submit Report'; btn.disabled = false;
  }
}

// ===== TOAST =====
function showToast(alert) {
  const toast = document.getElementById('alertToast');
  if (!toast) return;
  const iconEl = document.getElementById('toastIcon');
  const titleEl = document.getElementById('toastTitle');
  const descEl  = document.getElementById('toastDesc');
  if (iconEl)  iconEl.textContent  = severityEmoji[alert.severity] || '🚨';
  if (titleEl) titleEl.textContent = alert.title;
  if (descEl)  descEl.textContent  = (alert.affectedAreas[0]?.city || '') + ' — ' + alert.severity.toUpperCase();
  toast.style.display = 'flex';
  setTimeout(() => closeToast(), 8000);
}

function closeToast() {
  const t = document.getElementById('alertToast');
  if (t) t.style.display = 'none';
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAlerts();
    await loadStats();
    initHeroMap();
    initResourceMap();
    await searchResources();
    // Set min date for any date inputs
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type=date]').forEach(el => el.setAttribute('min', today));
  } catch(e) {
    console.error('Init error:', e);
  }
});