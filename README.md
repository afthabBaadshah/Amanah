# 🛡️ Amanah — Disaster Management & Alert System
### Built for Vishwakarma Hackathon 2026 | Cambridge Institute of Technology

---

## 🚀 Quick Setup (Step by Step)

### Step 1 — Install Prerequisites
- Node.js: https://nodejs.org (LTS version)
- MongoDB Community: https://www.mongodb.com/try/download/community
  - Install and start MongoDB service

### Step 2 — Install Dependencies
```bash
cd amanah
npm install
```

### Step 3 — Generate VAPID Keys (Push Notifications)
```bash
node generate-vapid.js
```
Copy the two keys printed into your `.env` file.

### Step 4 — Configure `.env` File
Edit the `.env` file and fill in:
```
GMAIL_USER=your@gmail.com
GMAIL_PASS=your-16-char-app-password     ← From myaccount.google.com → App Passwords

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx    ← From console.twilio.com
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE=+1234567890

WEATHER_API_KEY=your_key                 ← Free at openweathermap.org/api

VAPID_PUBLIC_KEY=...                     ← From Step 3
VAPID_PRIVATE_KEY=...                    ← From Step 3
```

### Step 5 — Start MongoDB
```bash
# Windows
net start MongoDB

# Mac
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

### Step 6 — Start Amanah
```bash
node server.js
```

### Step 7 — Open in Browser
- 🌐 App:       http://localhost:3000
- 🔐 Admin:     http://localhost:3000/admin
- 🗺️ Live Map:  http://localhost:3000/map

**Default Admin Login:**
- Email:    admin@amanah.com
- Password: Admin@123

---

## 🌟 Features

| Feature | Description |
|---|---|
| 🚨 Real-time Alerts | Admin triggers alerts, instantly pushed to all users in affected areas |
| 📱 Browser Push | Users get push notifications even when tab is closed |
| 📧 Email Alerts | Beautiful HTML email with severity, instructions, helplines |
| 📱 SMS Alerts | Twilio SMS to all affected users' phones |
| 🗺️ Live Map | Leaflet.js map with alert zones, resources, citizen reports |
| 👤 User Accounts | Register with city/state, receive only relevant alerts |
| 📝 Citizen Reports | Users report incidents, admin verifies/dismisses |
| 🏥 Resource Tracker | Hospitals, shelters, food, rescue centres on map |
| 📊 Admin Dashboard | Stats, charts, manage all alerts, users, resources |
| ⚡ Socket.IO | Real-time updates across all connected clients |
| 🌦️ Weather Data | OpenWeatherMap API data attached to each alert |
| 💾 MongoDB | Full persistent database for all data |

## 🏗️ Architecture
```
Client (Browser)
   ↕ Socket.IO (real-time)
   ↕ REST API
Node.js + Express Server
   ↕
MongoDB Database
   ↓ On Alert Trigger
Email (Nodemailer) + SMS (Twilio) + Push (web-push)
```

## 📁 Project Structure
```
amanah/
├── server.js              ← Main server
├── .env                   ← Your credentials
├── generate-vapid.js      ← Run once for push keys
├── models/index.js        ← MongoDB schemas
├── routes/
│   ├── auth.js            ← Login, register, push
│   ├── alerts.js          ← Alert CRUD + trigger
│   └── data.js            ← Resources, reports, users
├── config/notifications.js← Email + SMS + Push
├── middleware/auth.js     ← JWT authentication
└── public/
    ├── index.html         ← Landing page
    ├── admin.html         ← Admin dashboard
    ├── dashboard.html     ← User dashboard
    ├── map.html           ← Full live map
    ├── login.html
    ├── register.html
    ├── sw.js              ← Service worker (push)
    ├── css/
    │   ├── main.css
    │   └── admin.css
    └── js/
        ├── main.js        ← Landing page logic
        ├── admin.js       ← Admin dashboard logic
        ├── dashboard.js   ← User dashboard logic
        ├── map.js         ← Live map logic
        └── auth.js        ← Login/register logic
```
