const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ===== USER MODEL =====
const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  phone:    { type: String, required: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['user', 'admin'], default: 'user' },
  location: {
    city:    { type: String, required: true },
    state:   { type: String, required: true },
    country: { type: String, default: 'India' },
    lat:     { type: Number },
    lng:     { type: Number }
  },
  isActive:      { type: Boolean, default: true },
  pushSubscription: { type: Object, default: null },
  alertsReceived:   { type: Number, default: 0 },
  createdAt:     { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ===== ALERT MODEL =====
const alertSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  type: {
    type: String,
    enum: ['flood','earthquake','cyclone','fire','tsunami','landslide','drought',
           'epidemic','industrial','terrorist','nuclear','chemical','other'],
    required: true
  },
  severity: { type: String, enum: ['low','medium','high','critical'], required: true },
  status:   { type: String, enum: ['active','resolved','monitoring'], default: 'active' },
  affectedAreas: [{
    city:  String,
    state: String,
    lat:   Number,
    lng:   Number,
    radius: { type: Number, default: 50 } // km
  }],
  instructions: [String],
  helplineNumbers: [String],
  weatherData:  { type: Object, default: null },
  triggeredBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notifiedCount:{ type: Number, default: 0 },
  resolvedAt:   { type: Date },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now }
});

// ===== RESOURCE MODEL =====
const resourceSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  type:     { type: String, enum: ['hospital','shelter','food','rescue','police','fire_station'], required: true },
  address:  { type: String, required: true },
  city:     { type: String, required: true },
  state:    { type: String, required: true },
  phone:    { type: String },
  capacity: { type: Number },
  available:{ type: Boolean, default: true },
  lat:      { type: Number, required: true },
  lng:      { type: Number, required: true },
  createdAt:{ type: Date, default: Date.now }
});

// ===== REPORT MODEL (citizen reports) =====
const reportSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  type:        { type: String, required: true },
  location: {
    city:  String,
    state: String,
    lat:   Number,
    lng:   Number
  },
  image:       { type: String },
  status:      { type: String, enum: ['pending','verified','dismissed'], default: 'pending' },
  reportedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = {
  User:     mongoose.model('User', userSchema),
  Alert:    mongoose.model('Alert', alertSchema),
  Resource: mongoose.model('Resource', resourceSchema),
  Report:   mongoose.model('Report', reportSchema)
};
