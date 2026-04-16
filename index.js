const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectdb = require('./config/db');

// Import routes
const authRoutes            = require('./routes/authRoutes');
const waterRequestRoutes    = require('./routes/waterRequests');
const driverRoutes          = require('./routes/driverRoutes');
const studentRoutes         = require('./routes/studentRoutes');
const analyticsRoutes       = require('./routes/analyticsRoutes');
const driverDashboardRoutes = require('./routes/driverDashboardRoutes');
const driverSettingsRoutes  = require('./routes/driverSettingsRoutes');
const studentSettingsRoutes = require('./routes/studentSettingsRoutes');
const broadcastRoutes = require('./routes/broadcastRoutes');
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');
const withdrawalRoutes      = require('./routes/withdrawalRoutes');






dotenv.config();
connectdb();

const app = express();

// ─── CORS Configuration ───────────────────────────────────────────────────────
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ],
  methods:          ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders:   ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials:      true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Request Logger ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  if (req.method !== 'OPTIONS') {
    console.log('Headers:', {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      contentType:   req.headers['content-type'],
    });
  }
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auth routes (student/admin login + register)
app.use('/api/auth', authRoutes);

app.use('/api/auth', driverRoutes);

// Driver dashboard & settings
app.use('/api/driver', driverDashboardRoutes);
app.use('/api/driver/settings', driverSettingsRoutes);
app.use('/api/student', studentSettingsRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/admin', adminSettingsRoutes);

// Withdrawals
app.use('/api/withdrawals', withdrawalRoutes);

// ✅ Driver CRUD — GET /api/drivers returns all drivers for admin
// This is the route your AdminDashboard was hitting and getting 404
app.use('/api/drivers', driverRoutes);

// Water requests
app.use('/api/water-requests', waterRequestRoutes);

// Payment
app.use('/api/payment', require('./routes/paymentRoutes'));

// Students
app.use('/api/students', studentRoutes);

// Analytics
app.use('/api/analytics', analyticsRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'PLASU HydroTrack API is running 🚀' });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `${field} is already in use`,
      errors:  [`Duplicate value for ${field}`],
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: 'Internal server error',
    error:   process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on PORT ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 API base: http://localhost:${PORT}/api`);
  console.log('');
  console.log('📌 Registered routes:');
  console.log('   POST   /api/auth/register');
  console.log('   POST   /api/auth/login');
  console.log('   POST   /api/auth/driver/register');
  console.log('   POST   /api/auth/driver/login');
  console.log('   GET    /api/drivers              ← all drivers (admin)');
  console.log('   GET    /api/driver/profile       ← logged-in driver profile');
  console.log('   GET    /api/driver/deliveries/today');
  console.log('   GET    /api/driver/earnings');
  console.log('   GET    /api/driver/settings');
  console.log('   GET    /api/water-requests');
  console.log('   GET    /api/students');
  console.log('   GET    /api/analytics');
  console.log('   GET    /api/health');
});