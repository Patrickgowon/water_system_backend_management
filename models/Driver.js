// models/Driver.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const driverSchema = new mongoose.Schema(
  {
    // ── Personal ────────────────────────────────────────────────────────────
    firstName:   { type: String, required: [true, 'First name is required'], trim: true },
    lastName:    { type: String, required: [true, 'Last name is required'],  trim: true },
    email: {
      type:     String,
      required: [true, 'Email is required'],
      unique:   true,
      lowercase: true,
      trim:     true,
      match:    [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type:     String,
      required: [true, 'Phone number is required'],
      match:    [/^[0-9]{11}$/, 'Phone number must be 11 digits'],
    },
    dateOfBirth: { type: Date,   required: [true, 'Date of birth is required'] },
    address:     { type: String, required: [true, 'Address is required'], trim: true },

    // ── Vehicle ─────────────────────────────────────────────────────────────
    tankerId: {
      type:     String,
      required: [true, 'Tanker ID is required'],
      unique:   true,
      uppercase: true,
      trim:     true,
    },
    vehicleType: {
      type:     String,
      required: [true, 'Vehicle type is required'],
      enum:     ['5,000L Tanker', '8,000L Tanker', '10,000L Tanker', '15,000L Tanker', '20,000L Tanker'],
    },
    vehiclePlate: {
      type:     String,
      required: [true, 'Plate number is required'],
      uppercase: true,
      trim:     true,
      match:    [/^[A-Z]{2,3}-\d{3}[A-Z]{2}$/i, 'Plate format must be ABC-123DE'],
    },
    vehicleCapacity: {
      type:     Number,
      required: [true, 'Vehicle capacity is required'],
      enum:     [5000, 8000, 10000, 15000, 20000],
    },
    vehicleYear: {
      type:     Number,
      required: [true, 'Vehicle year is required'],
      min:      [2000, 'Vehicle year must be 2000 or later'],
      max:      [new Date().getFullYear(), 'Vehicle year cannot be in the future'],
    },

    // ── License & Experience ────────────────────────────────────────────────
    licenseNumber: {
      type:     String,
      required: [true, 'License number is required'],
      unique:   true,
      uppercase: true,
      trim:     true,
    },
    licenseExpiry: {
      type:     Date,
      required: [true, 'License expiry date is required'],
    },
    yearsExperience: {
      type:     String,
      required: [true, 'Years of experience is required'],
      enum:     ['< 1 year', '1–2 years', '3–5 years', '5–10 years', '10+ years'],
    },
    emergencyContact: { type: String, required: [true, 'Emergency contact name is required'], trim: true },
    emergencyPhone: {
      type:     String,
      required: [true, 'Emergency contact phone is required'],
      match:    [/^[0-9]{11}$/, 'Emergency phone must be 11 digits'],
    },

    // ── Security ────────────────────────────────────────────────────────────
    password: {
      type:     String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select:   false,
    },

    // ── Operational / Admin fields ──────────────────────────────────────────
    role:         { type: String, default: 'driver' },
    status: {
      type:    String,
      enum:    ['pending', 'active', 'inactive', 'suspended', 'on-leave'],
      default: 'pending',
    },
    isVerified:      { type: Boolean, default: false },
    online:          { type: Boolean, default: false },
    currentLocation: { type: String,  default: '' },
    rating:          { type: Number,  default: 0, min: 0, max: 5 },
    totalDeliveries: { type: Number,  default: 0 },
    totalRatings:    { type: Number,  default: 0 },
    ratingSum:       { type: Number,  default: 0 },

    // ── Driver Settings ─────────────────────────────────────────────────────
    settings: {
      // Notification Settings
      newDeliveryAlert: { type: Boolean, default: true },
      smsConfirm:       { type: Boolean, default: true },
      lowFuelWarn:      { type: Boolean, default: true },
      
      // Availability Settings
      autoAccept:          { type: Boolean, default: false },
      weekends:            { type: Boolean, default: false },
      nightShift:          { type: Boolean, default: false },
      preferredMaxDistance: { type: Number, default: 20, min: 5, max: 100 },
      preferredWorkingHours: {
        start: { type: String, default: '08:00' },
        end:   { type: String, default: '18:00' }
      },
      breakTime: { type: Number, default: 60, min: 15, max: 120 },
      
      // Navigation Settings
      voiceNav:        { type: Boolean, default: true },
      trafficAlerts:   { type: Boolean, default: true },
      shareLocation:   { type: Boolean, default: true },
      showOnlineStatus: { type: Boolean, default: true },
      
      // Communication Preferences
      language: {
        type: String,
        enum: ['English', 'Hausa', 'Yoruba', 'Igbo'],
        default: 'English'
      },
      pushNotifications:  { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      
      // Vehicle Preferences
      preferredFuelStation: { type: String, default: '' },
      vehicleReminders: {
        maintenance: { type: Boolean, default: true },
        insurance:   { type: Boolean, default: true }
      }
    },

    // ── Additional Driver Fields ────────────────────────────────────────────
    preferredRoutes: {
      type: [String],
      default: []
    },
    
    vehicleHealth: {
      fuel:  { type: Number, default: 100, min: 0, max: 100 },
      engine: { type: Number, default: 100, min: 0, max: 100 },
      tyres: { type: Number, default: 100, min: 0, max: 100 },
      oil:   { type: Number, default: 100, min: 0, max: 100 },
      lastMaintenance: { type: Date },
      nextMaintenance: { type: Date }
    },
    
    notifications: [{
      type: {
        type: String,
        enum: ['delivery', 'system', 'payment', 'maintenance', 'alert']
      },
      title: String,
      message: String,
      read: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    }],
    // Add this field to your driver schema
incidents: [{
  type: {
    type: String,
    enum: ['breakdown', 'accident', 'flat', 'fuel', 'delay', 'other']
  },
  description: String,
  reportedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'resolved'], default: 'pending' }
}],
incidentsCount: { type: Number, default: 0 }
    ,
    
    ratings: [{
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WaterRequest' },
      rating:  { type: Number, min: 1, max: 5 },
      review:  String,
      createdAt: { type: Date, default: Date.now }
    }],

    // ── Tokens ──────────────────────────────────────────────────────────────
    passwordResetToken:   { type: String,  select: false },
    passwordResetExpires: { type: Date,    select: false },
    lastLogin:            { type: Date },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  },
  
);

// ── Virtual: full name ───────────────────────────────────────────────────────
driverSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ── Virtual: driver display name ─────────────────────────────────────────────
driverSchema.virtual('displayName').get(function () {
  return `${this.firstName} ${this.lastName.charAt(0)}.`;
});

// ── Pre-save: hash password ──────────────────────────────────────────────────
// ── Pre-save: hash password ──────────────────────────────────────────────────
driverSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();  // ✅ password unchanged, continue
  }
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();  // ✅ hashing done, continue
  } catch (err) {
    next(err);  // ✅ was empty before — this was the bug!
  }
});



// ── Instance method: compare password ───────────────────────────────────────
driverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method: update rating ──────────────────────────────────────────
driverSchema.methods.updateRating = function (newRating) {
  this.totalRatings += 1;
  this.ratingSum    += newRating;
  this.rating        = parseFloat((this.ratingSum / this.totalRatings).toFixed(1));
  return this.save();
};

// ── Instance method: add notification ───────────────────────────────────────
driverSchema.methods.addNotification = function (type, title, message) {
  this.notifications.unshift({
    type,
    title,
    message,
    read: false,
    createdAt: new Date()
  });
  // Keep only last 50 notifications
  if (this.notifications.length > 50) {
    this.notifications = this.notifications.slice(0, 50);
  }
  return this.save();
};

// ── Instance method: update vehicle health ──────────────────────────────────
driverSchema.methods.updateVehicleHealth = function (updates) {
  if (updates.fuel !== undefined) this.vehicleHealth.fuel = Math.min(100, Math.max(0, updates.fuel));
  if (updates.engine !== undefined) this.vehicleHealth.engine = Math.min(100, Math.max(0, updates.engine));
  if (updates.tyres !== undefined) this.vehicleHealth.tyres = Math.min(100, Math.max(0, updates.tyres));
  if (updates.oil !== undefined) this.vehicleHealth.oil = Math.min(100, Math.max(0, updates.oil));
  
  // Low fuel warning
  if (this.vehicleHealth.fuel < 20 && this.settings.lowFuelWarn) {
    this.addNotification('alert', 'Low Fuel Warning', `Fuel level is at ${this.vehicleHealth.fuel}%. Please refuel soon.`);
  }
  
  return this.save();
};

// ── Instance method: get unread notifications count ─────────────────────────
driverSchema.methods.getUnreadCount = function () {
  return this.notifications.filter(n => !n.read).length;
};

// ── Instance method: reset settings to default ──────────────────────────────
driverSchema.methods.resetSettings = function () {
  this.settings = {
    newDeliveryAlert: true,
    smsConfirm: true,
    lowFuelWarn: true,
    autoAccept: false,
    weekends: false,
    nightShift: false,
    voiceNav: true,
    trafficAlerts: true,
    preferredMaxDistance: 20,
    preferredWorkingHours: { start: '08:00', end: '18:00' },
    breakTime: 60,
    language: 'English',
    pushNotifications: true,
    emailNotifications: true,
    shareLocation: true,
    showOnlineStatus: true,
    preferredFuelStation: '',
    vehicleReminders: {
      maintenance: true,
      insurance: true
    }
  };
  
  return this.save();
};

// ── Indexes: speed up common queries ────────────────────────────────────────
driverSchema.index({ status: 1, online: 1 });
driverSchema.index({ 'settings.autoAccept': 1 });
driverSchema.index({ createdAt: -1 });


module.exports = mongoose.model('Driver', driverSchema);