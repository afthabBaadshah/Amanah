require('dotenv').config();
const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const mongoose  = require('mongoose');
const path      = require('path');
const { setupWebPush } = require('./config/notifications');
const { User, Alert, Resource } = require('./models');
const bcrypt    = require('bcryptjs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api',        require('./routes/data'));

// Serve pages
app.get('/admin',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/dashboard',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/map',           (req, res) => res.sendFile(path.join(__dirname, 'public', 'map.html')));
app.get('/register',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/login',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('*',              (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// WebSocket
const connectedUsers = new Map();
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('register-user', (userId) => {
    connectedUsers.set(userId, socket.id);
    socket.userId = userId;
    io.emit('online-count', connectedUsers.size);
  });

  socket.on('disconnect', () => {
    if (socket.userId) connectedUsers.delete(socket.userId);
    io.emit('online-count', connectedUsers.size);
    console.log('Client disconnected:', socket.id);
  });

  // Admin sends targeted alert to specific socket
  socket.on('send-targeted-alert', ({ userIds, alert }) => {
    userIds.forEach(uid => {
      const sid = connectedUsers.get(uid);
      if (sid) io.to(sid).emit('new-alert', { alert });
    });
  });
});

// DB + Seed
async function seedData() {
  // Seed admin
  const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });
  if (!adminExists) {
    await User.create({
      name: 'Amanah Admin',
      email: process.env.ADMIN_EMAIL,
      phone: '+919999999999',
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
      location: { city: 'Bengaluru', state: 'Karnataka' }
    });
    console.log('✅ Admin created:', process.env.ADMIN_EMAIL);
  }

  // Seed sample resources
  const resCount = await Resource.countDocuments();
  if (resCount === 0) {
    await Resource.insertMany([
      { name: 'NIMHANS Hospital', type: 'hospital', address: 'Hosur Road', city: 'Bengaluru', state: 'Karnataka', phone: '080-46110007', capacity: 500, lat: 12.9433, lng: 77.5971 },
      { name: 'Victoria Hospital', type: 'hospital', address: 'Fort Road', city: 'Bengaluru', state: 'Karnataka', phone: '080-26706928', capacity: 1200, lat: 12.9626, lng: 77.5757 },
      { name: 'Government Shelter Koramangala', type: 'shelter', address: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', phone: '080-12345678', capacity: 200, lat: 12.9352, lng: 77.6245 },
      { name: 'Fire Station Shivajinagar', type: 'fire_station', address: 'Shivajinagar', city: 'Bengaluru', state: 'Karnataka', phone: '101', lat: 12.9849, lng: 77.6016 },
      { name: 'Chennai General Hospital', type: 'hospital', address: 'Park Town', city: 'Chennai', state: 'Tamil Nadu', phone: '044-25305000', capacity: 1500, lat: 13.0827, lng: 80.2707 },
      { name: 'Mumbai Relief Shelter', type: 'shelter', address: 'Dharavi', city: 'Mumbai', state: 'Maharashtra', phone: '022-12345678', capacity: 500, lat: 19.0760, lng: 72.8777 },
      { name: 'Delhi AIIMS', type: 'hospital', address: 'Ansari Nagar', city: 'Delhi', state: 'Delhi', phone: '011-26588500', capacity: 2000, lat: 28.5672, lng: 77.2100 },
      { name: 'Kolkata Rescue Centre', type: 'rescue', address: 'Salt Lake', city: 'Kolkata', state: 'West Bengal', phone: '033-12345678', capacity: 300, lat: 22.5726, lng: 88.3639 },
    ]);
    console.log('✅ Sample resources seeded');
  }
}

// Connect & Start
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    setupWebPush();
    await seedData();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`\n🛡️  Amanah is running!`);
      console.log(`   ➜ App:   http://localhost:${PORT}`);
      console.log(`   ➜ Admin: http://localhost:${PORT}/admin`);
      console.log(`   ➜ Admin login: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}\n`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
