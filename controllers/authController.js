const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User   = require('../models/users');
const { sendOTPEmail } = require('../utils/emailService');
const Driver = require('../models/Driver'); 


const signToken = (userId, role) => {
  console.log('🔐 Generating token for user ID:', userId, '| Role:', role);
  const jwtSecret = process.env.JWT_SECRET || 'mysecret123';
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️ WARNING: JWT_SECRET not set in environment variables. Using default for development.');
  }
  const token = jwt.sign(
    { id: userId, role },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  console.log('🔐 Token generated successfully, length:', token.length);
  return token;
};

const sendTokenResponse = (res, statusCode, user, message) => {
  const token = signToken(user._id);
  
  // Set cookie options
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };
  
  res.cookie('token', token, cookieOptions);
  console.log('🍪 Token set in cookie');
  console.log('📤 Sending response with token preview:', token.substring(0, 30) + '...');
  
  // Prepare user data for response
  const userData = typeof user.toSafeObject === 'function' 
    ? user.toSafeObject() 
    : {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        matricNumber: user.matricNumber,
        department: user.department,
        level: user.level,
        hall: user.hall,
        roomNumber: user.roomNumber,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        // Driver specific fields
        licenseNumber: user.licenseNumber,
        tankerId: user.tankerId,
        vehicleType: user.vehicleType,
        isOnline: user.isOnline,
        rating: user.rating,
        totalDeliveries: user.totalDeliveries,
        currentLocation: user.currentLocation,
        // Student specific fields
        plan: user.plan,
        balance: user.balance,
        totalOrders: user.totalOrders,
        totalSpent: user.totalSpent
      };
  
  res.status(statusCode).json({
    success: true,
    message,
    token,
    data: userData
  });
};

// ─── Create Admin User (Temporary - Remove after first use) ───────────────────
exports.createAdmin = async (req, res) => {
  try {
    console.log('📝 Creating admin user...');
    
    const { email, password, firstName, lastName, phone } = req.body;
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin user already exists. Please login with admin credentials.',
        data: { email: existingAdmin.email }
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password || 'admin123', salt);
    
    // Create admin user
    const admin = await User.create({
      firstName: firstName || 'Super',
      lastName: lastName || 'Admin',
      email: (email || 'admin@hydrosystem.com').toLowerCase(),
      phone: phone || '08000000000',
      password: hashedPassword,
      role: 'admin',
      isVerified: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Admin user created successfully:', admin.email);
    
    // Generate token
    const token = signToken(admin._id);
    
    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      token,
      data: {
        _id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        role: admin.role,
        isVerified: admin.isVerified
      }
    });
  } catch (err) {
    console.error('❌ Create admin error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Check if admin exists (utility endpoint) ─────────────────────────────────
exports.checkAdmin = async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' }).select('-password');
    
    if (admin) {
      res.status(200).json({
        success: true,
        message: 'Admin user exists',
        data: {
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'No admin user found. Please create one using /api/auth/create-admin'
      });
    }
  } catch (err) {
    console.error('❌ Check admin error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


// ─── Generate 6-digit OTP ─────────────────────────────────────────────────────
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─── Register ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone,
      matricNumber, department, level,
      hall, roomNumber, password, confirmPassword
    } = req.body;

    if (!email || !password || !confirmPassword)
      return res.status(400).json({ success: false, message: 'Required fields missing' });
    if (password !== confirmPassword)
      return res.status(400).json({ success: false, message: 'Passwords do not match' });

    // Check existing user
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { matricNumber: matricNumber?.toUpperCase() }]
    });
    if (existingUser)
      return res.status(409).json({ success: false, message: 'User already exists' });

    // ✅ Generate OTP
    const otp       = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user with isVerified = false
    const user = await User.create({
      firstName, lastName,
      email:        email.toLowerCase(),
      phone,
      matricNumber: matricNumber?.toUpperCase(),
      department, level, hall, roomNumber,
      password,
      role:         'student',
      isVerified:   false,
      verificationToken:       otp,
      verificationTokenExpiry: otpExpiry,
    });

    // ✅ Send OTP email
    try {
      await sendOTPEmail({ email: user.email, firstName: user.firstName, otp });
    } catch (emailErr) {
      console.error('OTP email failed:', emailErr.message);
      // Delete user if email fails so they can retry
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please check your email address and try again.'
      });
    }

    console.log('✅ Registered & OTP sent:', user.email);
    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email for the OTP verification code.',
      data: { email: user.email, firstName: user.firstName }
    });

  } catch (err) {
    console.error('❌ REGISTER ERROR:', err.name, '-', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: 'Validation failed', errors: messages });
    }
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ success: false, message: `An account with this ${field} already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const user = await User.findOne({
      email:                   email.toLowerCase(),
      verificationToken:       otp,
      verificationTokenExpiry: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });

    // ✅ Mark as verified
    user.isVerified              = true;
    user.verificationToken       = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    console.log('✅ Email verified:', user.email);
    sendTokenResponse(res, 200, user, 'Email verified successfully! Welcome to PLASU HydroTrack.');

  } catch (err) {
    console.error('❌ VERIFY OTP ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Resend OTP ───────────────────────────────────────────────────────────────
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase(), isVerified: false });
    if (!user)
      return res.status(404).json({ success: false, message: 'No pending verification found for this email' });

    const otp       = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.verificationToken       = otp;
    user.verificationTokenExpiry = otpExpiry;
    await user.save({ validateBeforeSave: false });

    await sendOTPEmail({ email: user.email, firstName: user.firstName, otp });

    res.status(200).json({ success: true, message: 'New OTP sent to your email.' });
  } catch (err) {
    console.error('❌ RESEND OTP ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// add this at the top

exports.login = async (req, res) => {
  try {
    console.log('📥 Login attempt:', req.body?.email);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    let user = null;
    let isDriver = false;

    // 1️⃣ Check User model first (admin + student)
    user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    // 2️⃣ If not found in User, check Driver model
    if (!user) {
      user = await Driver.findOne({ email: email.toLowerCase() }).select('+password');
      if (user) isDriver = true;
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = typeof user.comparePassword === 'function'
      ? await user.comparePassword(password)
      : await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Check if driver account is active (drivers use 'status' field)
    if (isDriver && user.status !== 'active') {
      return res.status(403).json({ 
        success: false, 
        message: user.status === 'pending' 
          ? 'Your driver account is pending admin approval.' 
          : 'Driver account is inactive. Contact admin.' 
      });
    }

    // Check if regular user is active
    if (!isDriver && user.isActive === false) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact support.' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    console.log('✅ Login successful:', user.email, '| Role:', user.role);

    // Build response data
    const userData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: isDriver ? 'driver' : user.role,
      isVerified: user.isVerified,
      // Driver specific
      ...(isDriver && {
        tankerId: user.tankerId,
        vehicleType: user.vehicleType,
        licenseNumber: user.licenseNumber,
        status: user.status,
        rating: user.rating,
        totalDeliveries: user.totalDeliveries,
      }),
      // Student specific
      ...(!isDriver && user.role === 'student' && {
        matricNumber: user.matricNumber,
        department: user.department,
        level: user.level,
        hall: user.hall,
        roomNumber: user.roomNumber,
        balance: user.balance,
        totalOrders: user.totalOrders,
      }),
    };

    const token = signToken(user._id, isDriver ? 'driver' : user.role);

    const cookieOptions = {
      httpOnly: true,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    res.cookie('token', token, cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: userData
    });

  } catch (err) {
    console.error('❌ LOGIN ERROR:', err.name, '-', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    console.log('📥 GetMe request received');
    console.log('📥 req.user exists:', !!req.user);
    
    if (!req.user) {
      console.log('❌ No user in request');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    console.log('📥 Looking up user with ID:', req.user._id);
    const user = await User.findById(req.user._id);
    
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    console.log('✅ User found:', user.email);
    
    // Prepare user data for response
    const userData = typeof user.toSafeObject === 'function' 
      ? user.toSafeObject() 
      : {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          matricNumber: user.matricNumber,
          department: user.department,
          level: user.level,
          hall: user.hall,
          roomNumber: user.roomNumber,
          role: user.role,
          isVerified: user.isVerified,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          // Driver specific fields
          licenseNumber: user.licenseNumber,
          tankerId: user.tankerId,
          vehicleType: user.vehicleType,
          isOnline: user.isOnline,
          rating: user.rating,
          totalDeliveries: user.totalDeliveries,
          currentLocation: user.currentLocation,
          // Student specific fields
          plan: user.plan,
          balance: user.balance,
          totalOrders: user.totalOrders,
          totalSpent: user.totalSpent
        };
    
    res.status(200).json({ 
      success: true, 
      data: userData 
    });
  } catch (err) {
    console.error('❌ GET ME ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.logout = (req, res) => {
  res.cookie('token', '', { 
    httpOnly: true, 
    expires: new Date(0),
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

exports.verifyEmail = async (req, res) => {
  try {
    const user = await User.findOne({
      verificationToken:       req.params.token,
      verificationTokenExpiry: { $gt: Date.now() },
    });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Token is invalid or has expired' });
    }
    
    user.isVerified              = true;
    user.verificationToken       = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });
    
    sendTokenResponse(res, 200, user, 'Email verified successfully!');
  } catch (err) {
    console.error('❌ VERIFY EMAIL ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email?.toLowerCase() });
    
    if (!user) {
      return res.status(200).json({ 
        success: true, 
        message: 'If that email is registered, a reset link has been sent.' 
      });
    }
    
    user.passwordResetToken  = crypto.randomBytes(32).toString('hex');
    user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    
    console.log('🔑 Reset token for', user.email, ':', user.passwordResetToken);
    
    res.status(200).json({ 
      success: true, 
      message: 'If that email is registered, a reset link has been sent.' 
    });
  } catch (err) {
    console.error('❌ FORGOT PASSWORD ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    
    const user = await User.findOne({
      passwordResetToken:  req.params.token,
      passwordResetExpiry: { $gt: Date.now() },
    });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Token is invalid or has expired' });
    }
    
    user.password            = password;
    user.passwordResetToken  = undefined;
    user.passwordResetExpiry = undefined;
    await user.save();
    
    sendTokenResponse(res, 200, user, 'Password reset successful');
  } catch (err) {
    console.error('❌ RESET PASSWORD ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};