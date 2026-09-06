const express = require('express');
const router  = express.Router();
const { Alert, User, Resource } = require('../models');
const { auth, adminAuth } = require('../middleware/auth');
const { notifyUser } = require('../config/notifications');
const axios = require('axios');

// Get all active alerts (public)
router.get('/', async (req, res) => {
  try {
    const alerts = await Alert.find({ status: { $in: ['active','monitoring'] } })
      .sort({ createdAt: -1 }).limit(50);
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all alerts (admin)
router.get('/all', adminAuth, async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 }).populate('triggeredBy', 'name email');
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single alert
router.get('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id).populate('triggeredBy', 'name');
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create & trigger alert (admin only)
router.post('/trigger', adminAuth, async (req, res) => {
  try {
    const {
      title, description, type, severity,
      affectedAreas, instructions, helplineNumbers
    } = req.body;

    // Fetch weather data for first area
    let weatherData = null;
    if (affectedAreas && affectedAreas[0] && process.env.WEATHER_API_KEY) {
      try {
        const area = affectedAreas[0];
        const query = area.city || area.state || 'India';
        const wRes = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?q=${query},IN&appid=${process.env.WEATHER_API_KEY}&units=metric`,
          { timeout: 5000 }
        );
        weatherData = {
          temp: wRes.data.main.temp,
          feels_like: wRes.data.main.feels_like,
          humidity: wRes.data.main.humidity,
          wind_speed: wRes.data.wind.speed,
          description: wRes.data.weather[0].description,
          icon: wRes.data.weather[0].icon
        };
      } catch { /* weather optional */ }
    }

    const alert = await Alert.create({
      title, description, type, severity,
      affectedAreas: affectedAreas || [],
      instructions: instructions || [],
      helplineNumbers: helplineNumbers || [],
      weatherData,
      triggeredBy: req.user._id
    });

    // Find affected users (match city/state)
    const cities  = affectedAreas.map(a => a.city?.toLowerCase()).filter(Boolean);
    const states  = affectedAreas.map(a => a.state?.toLowerCase()).filter(Boolean);

    const query = {
      isActive: true, role: 'user',
      $or: [
        { 'location.city':  { $in: cities.map(c => new RegExp(c,'i'))  } },
        { 'location.state': { $in: states.map(s => new RegExp(s,'i')) } }
      ]
    };
    const affectedUsers = await User.find(query);

    // Emit socket event to all connected clients
    req.app.get('io').emit('new-alert', {
      alert: { ...alert.toObject(), affectedAreas }
    });

    // Send notifications asynchronously
    let notified = 0;
    const notifyPromises = affectedUsers.map(async user => {
      await notifyUser(user, alert);
      notified++;
    });
    Promise.allSettled(notifyPromises).then(async () => {
      await Alert.findByIdAndUpdate(alert._id, { notifiedCount: notified });
    });

    res.status(201).json({
      success: true,
      alert,
      affectedUsersCount: affectedUsers.length,
      message: `Alert created. Notifying ${affectedUsers.length} users...`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update alert status
router.patch('/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date(), ...(status === 'resolved' ? { resolvedAt: new Date() } : {}) },
      { new: true }
    );
    req.app.get('io').emit('alert-updated', { alert });
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete alert
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats
router.get('/stats/summary', async (req, res) => {
  try {
    const [total, active, resolved, bySeverity, byType] = await Promise.all([
      Alert.countDocuments(),
      Alert.countDocuments({ status: 'active' }),
      Alert.countDocuments({ status: 'resolved' }),
      Alert.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      Alert.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }])
    ]);
    const totalUsers = await User.countDocuments({ role: 'user' });
    res.json({ total, active, resolved, totalUsers, bySeverity, byType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
