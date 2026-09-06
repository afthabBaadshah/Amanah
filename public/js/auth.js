// ===== REGISTER =====
async function registerUser() {
  const name     = document.getElementById('rName')?.value.trim();
  const email    = document.getElementById('rEmail')?.value.trim();
  const phone    = document.getElementById('rPhone')?.value.trim();
  const city     = document.getElementById('rCity')?.value.trim();
  const state    = document.getElementById('rState')?.value.trim();
  const password = document.getElementById('rPassword')?.value;

  const errEl = document.getElementById('regError');
  errEl.style.display = 'none';

  if (!name || !email || !phone || !city || !state || !password) {
    errEl.textContent = 'All fields are required.';
    errEl.style.display = 'block'; return;
  }
  if (password.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
    errEl.style.display = 'block'; return;
  }

  const btn = document.getElementById('regBtn');
  btn.textContent = 'Registering...'; btn.disabled = true;

  let lat = 0, lng = 0;
  try {
    await new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(pos => {
        lat = pos.coords.latitude; lng = pos.coords.longitude; resolve();
      }, () => resolve(), { timeout: 4000 });
    });
  } catch(e) {}

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password, city, state, lat, lng })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    localStorage.setItem('amanahToken', data.token);
    localStorage.setItem('amanahUser', JSON.stringify(data.user));

    await requestPushPermission(data.token);

    window.location.href = '/dashboard';
  } catch(err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.textContent = 'Register & Enable Alerts';
    btn.disabled = false;
  }
}

// ===== LOGIN =====
async function loginUser() {
  const email    = document.getElementById('lEmail')?.value.trim();
  const password = document.getElementById('lPassword')?.value;
  const errEl    = document.getElementById('loginError');
  errEl.style.display = 'none';

  if (!email || !password) {
    errEl.textContent = 'Please enter email and password.';
    errEl.style.display = 'block'; return;
  }

  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Logging in...'; btn.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    localStorage.setItem('amanahToken', data.token);
    localStorage.setItem('amanahUser', JSON.stringify(data.user));

    await requestPushPermission(data.token);

    window.location.href = data.user.role === 'admin' ? '/admin' : '/dashboard';
  } catch(err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.textContent = 'Login';
    btn.disabled = false;
  }
}

// ===== PUSH PERMISSION =====
async function requestPushPermission(token) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const vapidRes = await fetch('/api/auth/vapid-key');
    if (!vapidRes.ok) return;
    const { publicKey } = await vapidRes.json();
    if (!publicKey) return;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await fetch('/api/auth/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ subscription })
    });
  } catch(e) {
    console.log('Push setup skipped:', e.message);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Enter key support
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('rName'))  registerUser();
    if (document.getElementById('lEmail')) loginUser();
  }
});