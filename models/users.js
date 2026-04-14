const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(

  {

    
    // ─── Personal Information ───────────────────────────────────────────────
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^[0-9]{11}$/, 'Phone number must be 11 digits'],
    },

    // ─── Academic Information (Student Only) ────────────────────────────────
    matricNumber: {
      type: String,
      unique: true,
      sparse: true,  // Allows null for non-students
      uppercase: true,
      trim: true,
      match: [
        /^PLASU\/\d{4}\/[A-Z]{2,6}\/\d{4}$/,
        'Matric number format: PLASU/YYYY/FACULTY/XXXX',
      ],
    },
    department: {
      type: String,
      enum: {
        values: [
          'Computer Science',
          'Information Technology',
          'Software Engineering',
          'Cyber Security',
          'Data Science',
          'Computer Engineering',
          'Electrical Engineering',
          'Mechanical Engineering',
          'Civil Engineering',
          'Business Administration',
          'Accounting',
          'Economics',
        ],
        message: '{VALUE} is not a valid department',
      },
    },
    level: {
      type: String,
      enum: {
        values: ['100', '200', '300', '400', '500'],
        message: '{VALUE} is not a valid level',
      },
    },

    // ─── Residence Information (Student Only) ───────────────────────────────
    hall: {
      type: String,
      enum: {
        values: [
          'Daniel Hall',
          'Joseph Hall',
          'Mary Hall',
          'Peter Hall',
          'Paul Hall',
          'Esther Hall',
          'Ruth Hall',
          'Samuel Hall',
        ],
        message: '{VALUE} is not a valid hall',
      },
    },
    roomNumber: {
      type: String,
      uppercase: true,
      trim: true,
    },

    // ─── Student Financial Information ──────────────────────────────────────
    plan: {
      type: String,
      enum: ['Basic', 'Standard', 'Premium'],
      default: 'Basic'
    },
    balance: {
      type: Number,
      default: 0
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },

    // ─── Driver Specific Fields ─────────────────────────────────────────────
    licenseNumber: {
      type: String,
      sparse: true,  // Allows null for non-drivers
      trim: true
    },
    tankerId: {
      type: String,
      sparse: true,  // Allows null for non-drivers
      trim: true
    },
    vehicleType: {
      type: String,
      enum: ['5000L Tanker', '8000L Tanker', '10000L Tanker'],
      default: '5000L Tanker'
    },
    emergencyContact: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalDeliveries: {
      type: Number,
      default: 0
    },
    currentLocation: {
      type: String,
      default: 'Depot'
    },
    lastActive: {
      type: Date,
      default: Date.now
    },

    price500L:          { type: Number, default: 5000  },
    price1000L:         { type: Number, default: 9000  },
    price1500L:         { type: Number, default: 12000 },
    baseRatePerLiter:   { type: Number, default: 100   },
    bonusPerDelivery:   { type: Number, default: 200   },
    tipAverage:         { type: Number, default: 50    },
    commissionPercent:  { type: Number, default: 15    },

    

    // ─── Security ───────────────────────────────────────────────────────────
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never return password in queries by default
    },
    // ─── In-app Notifications ─────────────────────────────────────────────────────
      inAppNotifications: [{
        id:        { type: Number },
        title:     { type: String },
        message:   { type: String },
        type:      { type: String, enum: ['info', 'warning', 'success', 'error'], default: 'info' },
        priority:  { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
        read:      { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      }],


      // ─── Admin Settings ───────────────────────────────────────────────────────────
        adminSettings: {
  // Notifications
  orderAlerts:             { type: Boolean, default: true  },
  driverAlerts:            { type: Boolean, default: true  },
  paymentAlerts:           { type: Boolean, default: true  },
  incidentAlerts:          { type: Boolean, default: true  },
  emailDigest:             { type: Boolean, default: true  },
  smsAlerts:               { type: Boolean, default: false },
  pushAlerts:              { type: Boolean, default: true  },
  // Automation
  autoApprove:             { type: Boolean, default: false },
  autoAssign:              { type: Boolean, default: false },
  // Security
  twoFA:                   { type: Boolean, default: false },
  sessionTimeout:          { type: Boolean, default: true  },
  auditLog:                { type: Boolean, default: true  },
  // System
  maintenanceMode:         { type: Boolean, default: false },
  maxDeliveriesPerDriver:  { type: Number,  default: 8    },
  defaultDeliveryWindow:   { type: Number,  default: 2    },
  cancellationWindow:      { type: Number,  default: 1    },
  // Pricing
  price500L:               { type: Number,  default: 5000  },
  price1000L:              { type: Number,  default: 9000  },
  price1500L:              { type: Number,  default: 12000 },
  // Commission
  baseRatePerLiter:        { type: Number,  default: 100   },
  bonusPerDelivery:        { type: Number,  default: 200   },
  tipAverage:              { type: Number,  default: 50    },
  commissionPercent:       { type: Number,  default: 15    },
},


    // ─── Notification & Preference Settings ─────────────────────────────────────
        notificationSettings: {
          deliveryAlerts:     { type: Boolean, default: true  },
          paymentReminders:   { type: Boolean, default: true  },
          requestUpdates:     { type: Boolean, default: true  },
          emailNotifications: { type: Boolean, default: true  },
          smsAlerts:          { type: Boolean, default: false },
          autoRenew:          { type: Boolean, default: false },
          consumptionTips:    { type: Boolean, default: true  },
          darkMode:           { type: Boolean, default: false },
        },
        // ─── In-app Notifications ─────────────────────────────────────────────────────
      'settings.notifications': { type: Array, default: [] },

    // ─── Account Status ─────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ['student', 'driver', 'admin'],
      default: 'student',
    },
    isVerified:  { type: Boolean, default: false },
    isActive:    { type: Boolean, default: true  },
    verificationToken:       { type: String, select: false },
    verificationTokenExpiry: { type: Date,   select: false },
    passwordResetToken:      { type: String, select: false },
    passwordResetExpiry:     { type: Date,   select: false },
    lastLogin:   { type: Date },

  },

  
  // ─── In-app Notifications ─────────────────────────────────────────────────────
  {
    
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtual: Full name ───────────────────────────────────────────────────────
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});



// ─── Virtual: User type display ──────────────────────────────────────────────
userSchema.virtual('userType').get(function () {
  if (this.role === 'student') return 'Student';
  if (this.role === 'driver') return 'Driver';
  return 'Administrator';
});

// ─── Pre-save Hook: Hash password ─────────────────────────────────────────────
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── Compare passwords ────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Strip sensitive fields ───────────────────────────────────────────────────
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verificationToken;
  delete obj.verificationTokenExpiry;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpiry;
  return obj;
};

module.exports = mongoose.model('User', userSchema);