// Wait for Leaflet to fully load before doing anything
window.addEventListener('DOMContentLoaded', () => {
  initEverything();
});

const socket = io();
let map = null;
let alertLayer    = null;
let resourceLayer = null;
let reportLayer   = null;

const layerState = { alerts: true, resources: true, reports: true };

const severityColor = {
  critical: '#7c3aed',
  high:     '#ef4444',
  medium:   '#f97316',
  low:      '#f59e0b'
};

const typeEmoji = {
  flood:'🌊', earthquake:'🌍', cyclone:'🌀', fire:'🔥',
  tsunami:'🌊', landslide:'⛰️', drought:'☀️', epidemic:'🦠',
  industrial:'🏭', terrorist:'💣', nuclear:'☢️', chemical:'🧪', other:'⚠️'
};

// ===== MAIN INIT =====
async function initEverything() {
  // Step 1: Create map
  map = L.map('fullMap', { zoomControl: true }).setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    maxZoom: 18
  }).addTo(map);

  // Step 2: Create layer groups and add to map
  alertLayer    = L.layerGroup().addTo(map);
  resourceLayer = L.layerGroup().addTo(map);
  reportLayer   = L.layerGroup().addTo(map);

  console.log('✅ Map initialized');
  console.log('✅ Layers created:', alertLayer, resourceLayer, reportLayer);

  // Step 3: Load all data
  await loadAlertMarkers();
  await loadResourceMarkers();
  await loadReportMarkers();
}

// ===== TOGGLE FUNCTION =====
// Called directly by onclick in HTML
function toggleLayer(name, btn) {
  // Flip state
  layerState[name] = !layerState[name];

  // Update button appearance
  if (layerState[name]) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }

  // Show or hide the layer
  if (name === 'alerts') {
    if (layerState.alerts) {
      map.addLayer(alertLayer);
      showFeedback('🚨 Alerts shown');
    } else {
      map.removeLayer(alertLayer);
      showFeedback('🚨 Alerts hidden');
    }
  }

  if (name === 'resources') {
    if (layerState.resources) {
      map.addLayer(resourceLayer);
      showFeedback('🏥 Resources shown');
    } else {
      map.removeLayer(resourceLayer);
      showFeedback('🏥 Resources hidden');
    }
  }

  if (name === 'reports') {
    if (layerState.reports) {
      map.addLayer(reportLayer);
      showFeedback('📝 Reports shown');
    } else {
      map.removeLayer(reportLayer);
      showFeedback('📝 Reports hidden');
    }
  }

  console.log('Layer toggled:', name, '→', layerState[name]);
}

// Small feedback message so user knows toggle worked
function showFeedback(msg) {
  let fb = document.getElementById('toggleFeedback');
  if (!fb) {
    fb = document.createElement('div');
    fb.id = 'toggleFeedback';
    fb.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(255,107,53,0.9);color:#fff;padding:8px 20px;border-radius:100px;font-size:13px;font-weight:600;z-index:9999;transition:opacity .3s;pointer-events:none';
    document.body.appendChild(fb);
  }
  fb.textContent = msg;
  fb.style.opacity = '1';
  clearTimeout(fb._timer);
  fb._timer = setTimeout(() => { fb.style.opacity = '0'; }, 1500);
}

// ===== LOAD ALERT MARKERS =====
async function loadAlertMarkers() {
  try {
    const res = await fetch('/api/alerts');
    if (!res.ok) throw new Error('Failed to fetch alerts');
    const { alerts } = await res.json();

    alertLayer.clearLayers();

    const sidebar = document.getElementById('mapSidebar');

    if (!alerts || alerts.length === 0) {
      if (sidebar) sidebar.innerHTML = '<div style="color:rgba(255,255,255,.4);font-size:13px;text-align:center;padding:20px">No active alerts right now</div>';
      console.log('No alerts to display');
      return;
    }

    console.log('Loading', alerts.length, 'alert markers');

    if (sidebar) {
      sidebar.innerHTML = alerts.map(a => `
        <div class="mi-item" onclick="flyTo(${a.affectedAreas[0]?.lat || 20}, ${a.affectedAreas[0]?.lng || 79})">
          <div class="mi-title">${typeEmoji[a.type] || '⚠️'} ${a.title}</div>
          <div class="mi-sub">${a.severity.toUpperCase()} · ${(a.affectedAreas || []).map(x => x.city).join(', ')}</div>
        </div>`).join('');
    }

    alerts.forEach(alert => {
      (alert.affectedAreas || []).forEach(area => {
        if (!area.lat || !area.lng) return;
        const color = severityColor[alert.severity] || '#ef4444';

        // Radius circle
        L.circle([area.lat, area.lng], {
          color, fillColor: color, fillOpacity: 0.15,
          weight: 2, radius: (area.radius || 50) * 1000
        }).addTo(alertLayer);

        // Center dot marker
        const icon = L.divIcon({
          html: `<div style="
            background:${color};
            width:18px;height:18px;
            border-radius:50%;
            border:3px solid white;
            box-shadow:0 0 14px ${color};
          "></div>`,
          className: '',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });

        L.marker([area.lat, area.lng], { icon })
          .addTo(alertLayer)
          .bindPopup(`
            <div style="font-family:sans-serif;min-width:200px">
              <div style="font-weight:700;font-size:15px;margin-bottom:6px">
                ${typeEmoji[alert.type] || '⚠️'} ${alert.title}
              </div>
              <div style="
                font-size:11px;background:${color};color:#fff;
                padding:2px 8px;border-radius:100px;
                display:inline-block;margin-bottom:8px;
                text-transform:uppercase;font-weight:700
              ">${alert.severity}</div>
              <div style="font-size:13px;color:#555;margin-bottom:6px">
                ${alert.description.substring(0, 120)}...
              </div>
              <div style="font-size:12px;color:#888">
                📍 ${area.city || ''}, ${area.state || ''}
              </div>
              ${alert.helplineNumbers?.length
                ? `<div style="font-size:13px;font-weight:700;color:${color};margin-top:6px">📞 ${alert.helplineNumbers.join(' · ')}</div>`
                : ''}
              ${alert.instructions?.length
                ? `<div style="font-size:12px;margin-top:8px;color:#666">⚠️ ${alert.instructions[0]}</div>`
                : ''}
            </div>`, { maxWidth: 280 });
      });
    });

    console.log('✅ Alert markers loaded');
  } catch(e) {
    console.error('❌ Alert markers error:', e.message);
  }
}

// ===== LOAD RESOURCE MARKERS =====
async function loadResourceMarkers() {
  try {
    const res = await fetch('/api/resources');
    if (!res.ok) throw new Error('Failed to fetch resources');
    const { resources } = await res.json();

    resourceLayer.clearLayers();

    const resIcons = {
      hospital:'🏥', shelter:'🏠', food:'🍱',
      rescue:'🚁', police:'👮', fire_station:'🚒'
    };

    let count = 0;
    resources.forEach(r => {
      if (!r.lat || !r.lng) return;
      const icon = L.divIcon({
        html: `<div style="
          background:#22c55e;
          width:30px;height:30px;
          border-radius:8px;
          border:2px solid white;
          display:flex;align-items:center;justify-content:center;
          font-size:15px;
          box-shadow:0 2px 8px rgba(0,0,0,.4);
        ">${resIcons[r.type] || '📍'}</div>`,
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      L.marker([r.lat, r.lng], { icon })
        .addTo(resourceLayer)
        .bindPopup(`
          <div style="font-family:sans-serif">
            <div style="font-weight:700;font-size:14px">
              ${resIcons[r.type] || '📍'} ${r.name}
            </div>
            <div style="font-size:12px;color:#888;margin:4px 0">
              ${r.address}, ${r.city}
            </div>
            ${r.phone
              ? `<div style="font-size:13px;font-weight:700;color:#22c55e">📞 ${r.phone}</div>`
              : ''}
            ${r.capacity
              ? `<div style="font-size:12px;color:#888">Capacity: ${r.capacity}</div>`
              : ''}
          </div>`);
      count++;
    });

    console.log('✅ Resource markers loaded:', count);
  } catch(e) {
    console.error('❌ Resource markers error:', e.message);
  }
}

// ===== LOAD REPORT MARKERS =====
async function loadReportMarkers() {
  try {
    const token = localStorage.getItem('amanahToken');
    if (!token) {
      console.log('Not logged in — skipping report markers');
      return;
    }

    const res = await fetch('/api/reports', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) {
      console.log('Could not load reports (not admin?)');
      return;
    }

    const { reports } = await res.json();
    reportLayer.clearLayers();

    let count = 0;
    reports
      .filter(r => r.location?.lat && r.location?.lng && r.status !== 'dismissed')
      .forEach(r => {
        const icon = L.divIcon({
          html: `<div style="
            background:#3b82f6;
            width:22px;height:22px;
            border-radius:50%;
            border:2px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,.4);
            display:flex;align-items:center;justify-content:center;
            font-size:12px;
          ">📝</div>`,
          className: '',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        L.marker([r.location.lat, r.location.lng], { icon })
          .addTo(reportLayer)
          .bindPopup(`
            <div style="font-family:sans-serif">
              <div style="font-weight:700;font-size:14px">${r.title}</div>
              <div style="font-size:12px;color:#888;margin:4px 0">
                ${r.location.city || ''}, ${r.location.state || ''}
              </div>
              <div style="font-size:12px;color:#555">
                ${r.description?.substring(0, 100) || ''}
              </div>
              <div style="
                font-size:11px;margin-top:6px;
                padding:2px 8px;background:#dbeafe;
                color:#3b82f6;border-radius:100px;display:inline-block
              ">${r.status}</div>
            </div>`);
        count++;
      });

    console.log('✅ Report markers loaded:', count);
  } catch(e) {
    console.error('❌ Report markers error:', e.message);
  }
}

// ===== HELPERS =====
function flyTo(lat, lng) {
  if (lat && lng && map) {
    map.flyTo([lat, lng], 10, { duration: 1.5 });
  }
}

// ===== SOCKET REAL-TIME =====
socket.on('new-alert', ({ alert }) => {
  console.log('New alert received via socket:', alert.title);
  loadAlertMarkers();
  if (alert.affectedAreas?.[0]?.lat) {
    map.flyTo([alert.affectedAreas[0].lat, alert.affectedAreas[0].lng], 9, { duration: 2 });
  }
});

socket.on('new-report', () => {
  console.log('New report received via socket');
  loadReportMarkers();
});