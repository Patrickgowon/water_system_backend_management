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
const server = http.createServer(app);

// ─── CORS Configuration ───────────────────────────────────────────────────────
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://water-supply-managementt.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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

app.set('io', io);

// ─── Socket.io Events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on('driver:join', (driverId) => {
    socket.join(`driver:${driverId}`);
    console.log(`🚚 Driver ${driverId} joined their room`);
  });

  socket.on('driver:location', async (data) => {
    const { driverId, lat, lng, locationName } = data;
    try {
      const Driver = require('./models/Driver');
      await Driver.findByIdAndUpdate(driverId, {
        currentLocation: locationName,
        currentLat:      lat,
        currentLng:      lng,
        lastSeen:        new Date(),
      });

      io.to('admin:tracking').emit('driver:locationUpdate', {
        driverId, lat, lng, locationName, timestamp: new Date(),
      });

      io.to(`tracking:${driverId}`).emit('driver:locationUpdate', {
        driverId, lat, lng, locationName, timestamp: new Date(),
      });

      console.log(`📍 Driver ${driverId} location: ${locationName} (${lat}, ${lng})`);
    } catch (err) {
      console.error('❌ Error saving driver location:', err.message);
    }
  });

  socket.on('admin:joinTracking', () => {
    socket.join('admin:tracking');
    console.log(`👮 Admin joined tracking room`);
  });

  socket.on('student:trackDriver', (driverId) => {
    socket.join(`tracking:${driverId}`);
    console.log(`🎓 Student tracking driver: ${driverId}`);
  });

  socket.on('student:stopTracking', (driverId) => {
    socket.leave(`tracking:${driverId}`);
    console.log(`🎓 Student stopped tracking driver: ${driverId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
  res.status(err.statusCode || 500).json({
    success: false,
    message: 'Internal server error',
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on PORT ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, io };