const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/users');
const bcrypt = require('bcryptjs');

const {
  register,
  login,
  verifyEmail,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  verifyOTP, 
  resendOTP
} = require('../controllers/authController');

const { protect, authorize } = require('../middleware/auth');

// ─── Public Routes ────────────────────────────────────────────────────────────
router.post('/register', register);
router.post('/login', login);
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.patch('/reset-password/:token', resetPassword);

// ─── Check if admin exists ────────────────────────────────────────────────────
router.get('/check-admin', async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' }).select('-password');
    if (admin) {
      res.status(200).json({
        success: true,
        message: 'Admin user exists',
        data: { email: admin.email, firstName: admin.firstName, lastName: admin.lastName, role: admin.role }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'No admin user found. Please create one using /api/auth/create-admin'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Create Admin (temporary) ─────────────────────────────────────────────────
router.post('/create-admin', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin user already exists.',
        data: { email: existingAdmin.email }
      });
    }
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password || 'admin123', salt);
    const admin = await User.create({
      firstName: firstName || 'Super',
      lastName:  lastName  || 'Admin',
      email:     (email || 'admin@hydrosystem.com').toLowerCase(),
      phone:     phone  || '08000000000',
      password:  hashedPassword,
      role:      'admin',
      isVerified: true,
      isActive:   true,
    });
    const token = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET || 'mysecret123',
      { expiresIn: '7d' }
    );
    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      token,
      data: { _id: admin._id, firstName: admin.firstName, lastName: admin.lastName, email: admin.email, role: admin.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Protected Routes ─────────────────────────────────────────────────────────
router.get('/me',     protect, getMe);
router.post('/logout', protect, logout);

router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

// ─── Update Profile ───────────────────────────────────────────────────────────
router.put('/update-profile', protect, async (req, res) => {
  try {
    const { firstName, lastName, phone, hall, roomNumber } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { firstName, lastName, phone, hall, roomNumber } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Change Password ──────────────────────────────────────────────────────────
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ success: false, message: 'New passwords do not match' });

    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    // Get user with password field
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    // Hash new password and update — use findByIdAndUpdate to bypass any pre-save hook issues
    const salt   = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(newPassword, salt);
    await User.findByIdAndUpdate(req.user.id, { password: hashed });

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Admin Only ───────────────────────────────────────────────────────────────
router.get('/admin-only', protect, authorize('admin'), (req, res) => {
  res.json({ success: true, message: 'Welcome Admin!', user: req.user });
});

module.exports = router;