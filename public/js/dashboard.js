const token = localStorage.getItem('amanahToken');
const user  = JSON.parse(localStorage.getItem('amanahUser') || 'null');

// Redirect if not logged in
if (!token || !user) window.location.href = '/login';

const socket = io();
socket.emit('register-user', user?.id);

// ===== SOCKET: NEW ALERT =====
socket.on('new-alert', ({ alert }) => {
  showDashToast(alert);
  loadMyAlerts();
});

// ===== INIT =====
window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('dashWelcome').textContent =
    `Welcome back, ${user.name} 👋 — Monitoring alerts for ${user.location?.city}, ${user.location?.state}`;
  document.getElementById('ds-location').textContent =
    `${user.location?.city}, ${user.location?.state}`;

  await loadMyAlerts();
  await loadNearbyResources();
  checkPushStatus();
});

function logout() {
  localStorage.removeItem('amanahToken');
  localStorage.removeItem('amanahUser');
  window.location.href = '/';
}

// ===== LOAD ALERTS FOR USER'S AREA =====
async function loadMyAlerts() {
  try {
    const res = await fetch('/api/alerts');
    const { alerts } = await res.json();

    const city  = user.location?.city?.toLowerCase();
    const state = user.location?.state?.toLowerCase();

    // Filter alerts relevant to user's location
    const myAlerts = alerts.filter(a =>
      a.affectedAreas?.some(area =>
        (area.city?.toLowerCase().includes(city) ||
         area.state?.toLowerCase().includes(state))
      )
    );

    document.getElementById('ds-active').textContent = myAlerts.filter(a => a.status === 'active').length;
    document.getElementById('ds-total').textContent  = alerts.length;

    const container = document.getElementById('myAlerts');
    if (!myAlerts.length) {
      container.innerHTML = '<div class="dl-item"><div class="dl-item-sub">✅ No active alerts in your area. Stay prepared!</div></div>';
      return;
    }

    const sevEmoji = { critical:'🚨', high:'🔴', medium:'🟠', low:'🟡' };
    const typEmoji = { flood:'🌊',earthquake:'🌍',cyclone:'🌀',fire:'🔥',tsunami:'🌊',landslide:'⛰️',drought:'☀️',epidemic:'🦠',industrial:'🏭',terrorist:'💣',nuclear:'☢️',chemical:'🧪',other:'⚠️' };

    container.innerHTML = myAlerts.map(a => `
      <div class="dl-item" style="border-left:3px solid ${severityColor(a.severity)}">
        <div class="dl-item-title">${typEmoji[a.type]||'⚠️'} ${a.title}</div>
        <div class="dl-item-sub">${sevEmoji[a.severity]} ${a.severity.toUpperCase()} · ${a.affectedAreas.map(x=>x.city).join(', ')}</div>
        ${a.instructions?.length ? `<div style="font-size:12px;color:#6b7a99;margin-top:6px">⚠️ ${a.instructions[0]}</div>` : ''}
        ${a.helplineNumbers?.length ? `<div style="font-size:12px;color:#FF6B35;margin-top:4px;font-weight:600">📞 ${a.helplineNumbers.join(' · ')}</div>` : ''}
        <div style="font-size:11px;color:#aaa;margin-top:6px">${new Date(a.createdAt).toLocaleString('en-IN')}</div>
      </div>`).join('');
  } catch(e) {
    document.getElementById('myAlerts').innerHTML = '<div class="dl-item-sub" style="color:red">Failed to load alerts.</div>';
  }
}

function severityColor(s) {
  return { critical:'#7c3aed', high:'#ef4444', medium:'#f97316', low:'#f59e0b' }[s] || '#f97316';
}

// ===== NEARBY RESOURCES =====
async function loadNearbyResources() {
  try {
    const city = user.location?.city;
    const res  = await fetch(`/api/resources?city=${encodeURIComponent(city)}`);
    const { resources } = await res.json();
    const container = document.getElementById('nearbyResources');
    const icons = { hospital:'🏥', shelter:'🏠', food:'🍱', rescue:'🚁', police:'👮', fire_station:'🚒' };

    if (!resources.length) {
      container.innerHTML = '<div class="dl-item"><div class="dl-item-sub">No resources found for your city.</div></div>';
      return;
    }
    container.innerHTML = resources.slice(0, 6).map(r => `
      <div class="dl-item">
        <div class="dl-item-title">${icons[r.type]||'📍'} ${r.name}</div>
        <div class="dl-item-sub">${r.address}, ${r.city}</div>
        ${r.phone ? `<div style="font-size:13px;font-weight:600;color:#FF6B35;margin-top:4px">📞 ${r.phone}</div>` : ''}
      </div>`).join('');
  } catch(e) {}
}

// ===== PUSH NOTIFICATIONS =====
function checkPushStatus() {
  const btn = document.getElementById('pushBtn');
  if (!btn) return;
  if (Notification.permission === 'granted') {
    btn.textContent = '🔔 Push Alerts Enabled';
    btn.style.background = '#22c55e';
    btn.disabled = true;
  }
}

async function enablePush() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { alert('Please allow notifications in your browser settings.'); return; }

    if (!('serviceWorker' in navigator)) { alert('Service workers not supported in your browser.'); return; }

    const reg = await navigator.serviceWorker.register('/sw.js');
    const vapidRes = await fetch('/api/auth/vapid-key');
    if (!vapidRes.ok) { alert('Push not configured yet. Add VAPID keys to .env'); return; }
    const { publicKey } = await vapidRes.json();
    if (!publicKey) { alert('VAPID key not set up. Run: node generate-vapid.js'); return; }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await fetch('/api/auth/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ subscription: sub })
    });

    const btn = document.getElementById('pushBtn');
    btn.textContent = '✅ Push Enabled!';
    btn.style.background = '#22c55e';
    btn.disabled = true;
  } catch(e) {
    alert('Push setup failed: ' + e.message);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ===== TOAST =====
function showDashToast(alert) {
  const sevEmoji = { critical:'🚨', high:'🔴', medium:'🟠', low:'🟡' };
  const div = document.createElement('div');
  div.style.cssText = `position:fixed;bottom:28px;right:28px;z-index:9999;background:#0f1624;border:2px solid #ef4444;border-radius:16px;padding:20px;max-width:340px;box-shadow:0 20px 60px rgba(0,0,0,.4);font-family:'DM Sans',sans-serif;animation:slideIn .4s ease`;
  div.innerHTML = `
    <div style="display:flex;gap:12px;align-items:flex-start">
      <div style="font-size:26px">${sevEmoji[alert.severity]||'🚨'}</div>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;margin-bottom:4px">${alert.title}</div>
        <div style="color:rgba(255,255,255,.5);font-size:13px">${alert.severity.toUpperCase()} · ${alert.affectedAreas?.[0]?.city||''}</div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,.4);font-size:18px;cursor:pointer;margin-left:auto">✕</button>
    </div>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 8000);
}
