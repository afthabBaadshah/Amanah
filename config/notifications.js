const nodemailer = require('nodemailer');
const webpush    = require('web-push');

// ===== EMAIL =====
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  tls: { rejectUnauthorized: false }
});

const severityColor = { low:'#f59e0b', medium:'#f97316', high:'#ef4444', critical:'#7c3aed' };
const severityEmoji = { low:'🟡', medium:'🟠', high:'🔴', critical:'🚨' };

async function sendEmailAlert(user, alert) {
  const color = severityColor[alert.severity] || '#ef4444';
  const emoji = severityEmoji[alert.severity] || '🚨';
  const areas = alert.affectedAreas.map(a => `${a.city}, ${a.state}`).join(' | ');
  const instructions = alert.instructions.map(i => `<li style="margin:6px 0">${i}</li>`).join('');
  const helplines = alert.helplineNumbers.map(n => `<span style="background:#fee2e2;padding:4px 10px;border-radius:6px;margin:4px;display:inline-block;font-weight:600">${n}</span>`).join('');

  await transporter.sendMail({
    from: `"Amanah Alert System" <${process.env.GMAIL_USER}>`,
    to: user.email,
    subject: `${emoji} DISASTER ALERT: ${alert.title} — ${alert.severity.toUpperCase()} severity`,
    html: `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)">
      <div style="background:${color};padding:32px;text-align:center">
        <div style="font-size:48px">${emoji}</div>
        <h1 style="color:#fff;margin:12px 0;font-size:24px">DISASTER ALERT</h1>
        <div style="background:rgba(255,255,255,0.2);color:#fff;padding:6px 20px;border-radius:100px;display:inline-block;font-weight:700;text-transform:uppercase;letter-spacing:1px">${alert.severity} SEVERITY</div>
      </div>
      <div style="padding:32px">
        <h2 style="color:#1a1a2e;margin:0 0 8px">${alert.title}</h2>
        <p style="color:#666;font-size:15px;line-height:1.6">${alert.description}</p>
        <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:24px 0;border-left:4px solid ${color}">
          <p style="margin:0 0 8px;font-weight:700;color:#1a1a2e">📍 Affected Areas</p>
          <p style="margin:0;color:#555;font-size:15px">${areas}</p>
        </div>
        ${instructions ? `<div style="margin:24px 0"><p style="font-weight:700;color:#1a1a2e;margin-bottom:12px">⚠️ Safety Instructions:</p><ul style="color:#555;padding-left:20px;font-size:15px;line-height:1.8">${instructions}</ul></div>` : ''}
        ${helplines ? `<div style="margin:24px 0"><p style="font-weight:700;color:#1a1a2e;margin-bottom:12px">📞 Emergency Helplines:</p>${helplines}</div>` : ''}
        <div style="background:#fef3c7;border-radius:12px;padding:16px;margin-top:24px">
          <p style="margin:0;color:#92400e;font-size:14px">⏰ Alert issued at: ${new Date(alert.createdAt).toLocaleString('en-IN')}</p>
        </div>
      </div>
      <div style="background:#1a1a2e;padding:20px;text-align:center">
        <p style="color:#888;font-size:13px;margin:0">Amanah Disaster Management System | Stay Safe</p>
      </div>
    </div>`
  });
}

// ===== SMS (Twilio) =====
async function sendSMSAlert(user, alert) {
  try {
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    const areas = alert.affectedAreas.map(a => `${a.city}`).join(', ');
    const msg = `🚨 AMANAH ALERT\n${alert.severity.toUpperCase()}: ${alert.title}\nAreas: ${areas}\n${alert.description.substring(0,100)}...\nStay safe! Check your email for full details.`;
    await twilio.messages.create({
      body: msg,
      from: process.env.TWILIO_PHONE,
      to: user.phone.startsWith('+') ? user.phone : '+91' + user.phone
    });
  } catch (err) {
    console.error('SMS error:', err.message);
  }
}

// ===== PUSH NOTIFICATION =====
function setupWebPush() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:' + process.env.GMAIL_USER,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
}

async function sendPushAlert(subscription, alert) {
  try {
    const emoji = severityEmoji[alert.severity] || '🚨';
    const payload = JSON.stringify({
      title: `${emoji} ${alert.severity.toUpperCase()}: ${alert.title}`,
      body: alert.description.substring(0, 120),
      icon: '/images/logo.png',
      badge: '/images/badge.png',
      data: { alertId: alert._id, url: '/' }
    });
    await webpush.sendNotification(subscription, payload);
  } catch (err) {
    console.error('Push error:', err.message);
  }
}

// ===== SEND ALL =====
async function notifyUser(user, alert) {
  const promises = [];
  if (user.email) promises.push(sendEmailAlert(user, alert).catch(e => console.error('Email fail:', e.message)));
  if (user.phone) promises.push(sendSMSAlert(user, alert).catch(e => console.error('SMS fail:', e.message)));
  if (user.pushSubscription) promises.push(sendPushAlert(user.pushSubscription, alert).catch(e => console.error('Push fail:', e.message)));
  await Promise.allSettled(promises);
}

module.exports = { notifyUser, sendEmailAlert, sendSMSAlert, sendPushAlert, setupWebPush };
