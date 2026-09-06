const express  = require('express');
const router   = express.Router();
const { Resource, Report, User } = require('../models');
const { auth, adminAuth } = require('../middleware/auth');

// ===== RESOURCES =====
router.get('/resources', async (req, res) => {
  try {
    const { city, state, type } = req.query;
    const filter = { available: true };
    if (city)  filter.city  = new RegExp(city, 'i');
    if (state) filter.state = new RegExp(state, 'i');
    if (type)  filter.type  = type;
    const resources = await Resource.find(filter).limit(100);
    res.json({ resources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/resources', adminAuth, async (req, res) => {
  try {
    const resource = await Resource.create(req.body);
    res.status(201).json({ success: true, resource });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/resources/:id', adminAuth, async (req, res) => {
  try {
    const resource = await Resource.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, resource });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CITIZEN REPORTS =====
router.get('/reports', adminAuth, async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 })
      .populate('reportedBy', 'name email location');
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reports', auth, async (req, res) => {
  try {
    const { title, description, type, city, state, lat, lng } = req.body;
    const report = await Report.create({
      title, description, type,
      location: { city, state, lat, lng },
      reportedBy: req.user._id
    });
    // Notify admin via socket
    req.app.get('io').emit('new-report', { report });
    res.status(201).json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/reports/:id', adminAuth, async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== USERS (admin) =====
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
