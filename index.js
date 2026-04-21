const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectdb = require('./config/db');
const http = require('http');
const { Server } = require('socket.io');

// Import routes
const authRoutes            = require('./routes/authRoutes');
const waterRequestRoutes    = require('./routes/waterRequests');
const driverRoutes          = require('./routes/driverRoutes');
const studentRoutes         = require('./routes/studentRoutes');
const analyticsRoutes       = require('./routes/analyticsRoutes');
const driverDashboardRoutes = require('./routes/driverDashboardRoutes');
const driverSettingsRoutes  = require('./routes/driverSettingsRoutes');
const studentSettingsRoutes = require('./routes/studentSettingsRoutes');
const broadcastRoutes       = require('./routes/broadcastRoutes');
const adminSettingsRoutes   = require('./routes/adminSettingsRoutes');
const withdrawalRoutes      = require('./routes/withdrawalRoutes');

dotenv.config();
connectdb();

const app    = express();
const server = http.createServer(app); // ← wrap express with http server

// ─── Socket.io Setup ──────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'https://water-supply-managementt.vercel.app'
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// Make io accessible in routes/controllers
app.set('io', io);

// ─── Socket.io Events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // ── Driver joins their own room ──────────────────────────────────────────
  socket.on('driver:join', (driverId) => {
    socket.join(`driver:${driverId}`);
    console.log(`🚚 Driver ${driverId} joined their room`);
  });

  // ── Driver sends location update ─────────────────────────────────────────
  socket.on('driver:location', async (data) => {
    // data = { driverId, lat, lng, locationName }
    const { driverId, lat, lng, locationName } = data;

    try {
      const Driver = require('./models/Driver');

      // Save to DB
      await Driver.findByIdAndUpdate(driverId, {
        currentLocation: locationName,
        currentLat:      lat,
        currentLng:      lng,
        lastSeen:        new Date(),
      });

      // Broadcast to admin room
      io.to('admin:tracking').emit('driver:locationUpdate', {
        driverId,
        lat,
        lng,
        locationName,
        timestamp: new Date(),
      });

      // Broadcast to students tracking this driver
      io.to(`tracking:${driverId}`).emit('driver:locationUpdate', {
        driverId,
        lat,
        lng,
        locationName,
        timestamp: new Date(),
      });

      console.log(`📍 Driver ${driverId} location: ${locationName} (${lat}, ${lng})`);
    } catch (err) {
      console.error('❌ Error saving driver location:', err.message);
    }
  });

  // ── Admin joins tracking room ─────────────────────────────────────────────
  socket.on('admin:joinTracking', () => {
    socket.join('admin:tracking');
    console.log(`👮 Admin joined tracking room`);
  });

  // ── Student joins tracking room for a specific driver ────────────────────
  socket.on('student:trackDriver', (driverId) => {
    socket.join(`tracking:${driverId}`);
    console.log(`🎓 Student tracking driver: ${driverId}`);
  });

  // ── Stop tracking ─────────────────────────────────────────────────────────
  socket.on('student:stopTracking', (driverId) => {
    socket.leave(`tracking:${driverId}`);
    console.log(`🎓 Student stopped tracking driver: ${driverId}`);
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

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
app.use('/api/auth',             authRoutes);
app.use('/api/auth',             driverRoutes);
app.use('/api/driver',           driverDashboardRoutes);
app.use('/api/driver/settings',  driverSettingsRoutes);
app.use('/api/student',          studentSettingsRoutes);
app.use('/api/broadcast',        broadcastRoutes);
app.use('/api/admin',            adminSettingsRoutes);
app.use('/api/withdrawals',      withdrawalRoutes);
app.use('/api/drivers',          driverRoutes);
app.use('/api/water-requests',   waterRequestRoutes);
app.use('/api/payment',          require('./routes/paymentRoutes'));
app.use('/api/students',         studentRoutes);
app.use('/api/analytics',        analyticsRoutes);

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
server.listen(PORT, () => {   // ← use server.listen not app.listen
  console.log(`✅ Server running on PORT ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 API base: http://localhost:${PORT}/api`);
  console.log(`🔌 Socket.io ready`);
  console.log('');
  console.log('📌 Registered routes:');
  console.log('   POST   /api/auth/register');
  console.log('   POST   /api/auth/login');
  console.log('   POST   /api/auth/driver/register');
  console.log('   POST   /api/auth/driver/login');
  console.log('   GET    /api/drivers');
  console.log('   GET    /api/driver/profile');
  console.log('   GET    /api/driver/deliveries/today');
  console.log('   GET    /api/driver/earnings');
  console.log('   GET    /api/driver/settings');
  console.log('   GET    /api/water-requests');
  console.log('   GET    /api/students');
  console.log('   GET    /api/analytics');
  console.log('   GET    /api/health');
});

// Export io for use in other files
module.exports = { app, io };