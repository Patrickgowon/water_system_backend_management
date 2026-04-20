// controllers/driverController.js
const Driver = require('../models/Driver');
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendOTPEmail } = require('../utils/emailService');

// ── Generate 6-digit OTP ─────────────────────────────────────────────────────
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Sign a JWT for the given driver id */
const signToken = (id) =>
  jwt.sign({ id, role: 'driver' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/** Send token + driver data in response */
const sendTokenResponse = (driver, statusCode, res) => {
  const token = signToken(driver._id);

  // Remove password from output
  driver.password = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    data: driver,
  });
};

/** Strip sensitive fields before returning driver objects */
const sanitizeDriver = (driver) => {
  const obj = driver.toObject ? driver.toObject() : driver;
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

// ════════════════════════════════════════════════════════════
//  @route   POST /api/auth/driver/register
//  @desc    Register a new driver
//  @access  Public
// ════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════
//  @route   POST /api/auth/driver/register
// ════════════════════════════════════════════════════════════
exports.registerDriver = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, dateOfBirth, address,
      tankerId, vehicleType, vehiclePlate, vehicleCapacity, vehicleYear,
      licenseNumber, licenseExpiry, yearsExperience,
      emergencyContact, emergencyPhone,
      password, confirmPassword,
    } = req.body;

    // ── 1. Basic presence check ─────────────────────────────
    const required = {
      firstName, lastName, email, phone, dateOfBirth, address,
      tankerId, vehicleType, vehiclePlate, vehicleCapacity, vehicleYear,
      licenseNumber, licenseExpiry, yearsExperience,
      emergencyContact, emergencyPhone, password, confirmPassword,
    };

    const missing = Object.entries(required)
      .filter(([, v]) => v === undefined || v === null || v === '')
      .map(([k]) => k);

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
        errors:  missing.map((f) => `${f} is required`),
      });
    }

    // ── 2. Password confirmation ────────────────────────────
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
        errors:  ['Passwords do not match'],
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
        errors:  ['Password must be at least 8 characters'],
      });
    }

    // ── 3. Duplicate checks ─────────────────────────────────
    const [emailExists, tankerExists, licenseExists] = await Promise.all([
      Driver.findOne({ email:         email.toLowerCase() }),
      Driver.findOne({ tankerId:      tankerId.toUpperCase() }),
      Driver.findOne({ licenseNumber: licenseNumber.toUpperCase() }),
    ]);

    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
        errors:  ['A driver with this email already exists'],
      });
    }
    if (tankerExists) {
      return res.status(409).json({
        success: false,
        message: 'Tanker ID is already registered',
        errors:  ['A driver with this Tanker ID already exists'],
      });
    }
    if (licenseExists) {
      return res.status(409).json({
        success: false,
        message: 'License number is already registered',
        errors:  ['A driver with this license number already exists'],
      });
    }

    // ── 4. License expiry must be in the future ─────────────
    if (new Date(licenseExpiry) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'License has already expired',
        errors:  ['License expiry date must be in the future'],
      });
    }

    // ── 5. Generate OTP ─────────────────────────────────────
    const otp       = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // ── 6. Create driver ────────────────────────────────────
    const driver = await Driver.create({
      firstName:        firstName.trim(),
      lastName:         lastName.trim(),
      email:            email.toLowerCase().trim(),
      phone,
      dateOfBirth:      new Date(dateOfBirth),
      address:          address.trim(),
      tankerId:         tankerId.toUpperCase().trim(),
      vehicleType,
      vehiclePlate:     vehiclePlate.toUpperCase().trim(),
      vehicleCapacity:  Number(vehicleCapacity),
      vehicleYear:      Number(vehicleYear),
      licenseNumber:    licenseNumber.toUpperCase().trim(),
      licenseExpiry:    new Date(licenseExpiry),
      yearsExperience,
      emergencyContact: emergencyContact.trim(),
      emergencyPhone,
      password,
      status:           'pending',
      isVerified:       false,
      verificationToken:       otp,
      verificationTokenExpiry: otpExpiry,
    });

    // ── 7. Send OTP email ────────────────────────────────────
    try {
      await sendOTPEmail({ email: driver.email, firstName: driver.firstName, otp });
    } catch (emailErr) {
      console.error('OTP email failed:', emailErr.message);
      await Driver.findByIdAndDelete(driver._id);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please check your email address and try again.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email for the OTP verification code.',
      data: { email: driver.email, firstName: driver.firstName },
    });

  } catch (err) {
    console.error('❌ registerDriver error:', err);

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: `${field} is already in use`,
        errors:  [`${field} is already in use`],
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
      errors:  [err.message],
    });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   POST /api/auth/driver/verify-otp
//  @desc    Verify driver OTP after registration
//  @access  Public
// ════════════════════════════════════════════════════════════
exports.verifyDriverOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    const driver = await Driver.findOne({
      email:                   email.toLowerCase(),
      verificationToken:       otp,
      verificationTokenExpiry: { $gt: Date.now() },
    });

    if (!driver) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.',
      });
    }

    // Mark as verified
    driver.isVerified              = true;
    driver.verificationToken       = undefined;
    driver.verificationTokenExpiry = undefined;
    await driver.save({ validateBeforeSave: false });

    console.log('✅ Driver email verified:', driver.email);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! Your account is now under admin review. You will be notified once approved (24–48 hours).',
      data: { email: driver.email, firstName: driver.firstName },
    });

  } catch (err) {
    console.error('❌ verifyDriverOTP error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   POST /api/auth/driver/resend-otp
//  @desc    Resend OTP to driver email
//  @access  Public
// ════════════════════════════════════════════════════════════
exports.resendDriverOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const driver = await Driver.findOne({
      email:      email.toLowerCase(),
      isVerified: false,
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'No pending verification found for this email',
      });
    }

    const otp       = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    driver.verificationToken       = otp;
    driver.verificationTokenExpiry = otpExpiry;
    await driver.save({ validateBeforeSave: false });

    await sendOTPEmail({ email: driver.email, firstName: driver.firstName, otp });

    return res.status(200).json({
      success: true,
      message: 'New OTP sent to your email.',
    });

  } catch (err) {
    console.error('❌ resendDriverOTP error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   POST /api/auth/driver/login
//  @desc    Login a driver
//  @access  Public
// ════════════════════════════════════════════════════════════
exports.loginDriver = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const driver = await Driver.findOne({ email: email.toLowerCase() }).select('+password');

    console.log("Driver found:", driver ? "YES" : "NO");

    if (!driver) {
      return res.status(401).json({ success: false, message: 'Driver not found' });
    }

    const isMatch = await driver.comparePassword(password);
    console.log("Password match:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    if (driver.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. Please wait 24–48 hours.',
      });
    }

    if (driver.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Contact support.',
      });
    }

    if (driver.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Contact support.',
      });
    }

    // ✅ Use findByIdAndUpdate instead of driver.save()
    // This bypasses the pre-save hook entirely
    await Driver.findByIdAndUpdate(
      driver._id,
      { lastLogin: new Date() },
      { validateBeforeSave: false }
    );

    return sendTokenResponse(driver, 200, res);

  } catch (err) {
    console.error('❌ loginDriver error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
      errors: [err.message],
    });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   GET /api/drivers
//  @desc    Get all drivers  (admin only)
//  @access  Private / Admin
// ════════════════════════════════════════════════════════════
exports.getAllDrivers = async (req, res) => {
  try {
    const {
      status, online, search,
      page = 1, limit = 20,
      sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const filter = {};
    if (status)              filter.status = status;
    if (online !== undefined) filter.online = online === 'true';
    if (search) {
      filter.$or = [
        { firstName:     { $regex: search, $options: 'i' } },
        { lastName:      { $regex: search, $options: 'i' } },
        { email:         { $regex: search, $options: 'i' } },
        { tankerId:      { $regex: search, $options: 'i' } },
        { licenseNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const sort  = { [sortBy]: order === 'asc' ? 1 : -1 };

    const [drivers, total] = await Promise.all([
      Driver.find(filter).sort(sort).skip(skip).limit(Number(limit)),
      Driver.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count:   drivers.length,
      total,
      page:    Number(page),
      pages:   Math.ceil(total / Number(limit)),
      data:    drivers.map(sanitizeDriver),
    });
  } catch (err) {
    console.error('❌ getAllDrivers error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      errors:  [err.message],
    });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   GET /api/drivers/:id
//  @desc    Get a single driver
//  @access  Private / Admin
// ════════════════════════════════════════════════════════════
exports.getDriverById = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
        errors:  ['Driver not found'],
      });
    }

    return res.status(200).json({ success: true, data: sanitizeDriver(driver) });
  } catch (err) {
    console.error('❌ getDriverById error:', err);

    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid driver ID',
        errors:  ['Invalid driver ID format'],
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
      errors:  [err.message],
    });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   PUT /api/drivers/:id/status
//  @desc    Update driver status / online flag (admin)
//  @access  Private / Admin
// ════════════════════════════════════════════════════════════
exports.updateDriverStatus = async (req, res) => {
  try {
    const { status, online, isVerified, currentLocation } = req.body;

    const allowedStatuses = ['pending', 'active', 'inactive', 'suspended', 'on-leave'];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
        errors:  ['Invalid status value'],
      });
    }

    const update = {};
    if (status          !== undefined) update.status          = status;
    if (online          !== undefined) update.online          = Boolean(online);
    if (isVerified      !== undefined) update.isVerified      = Boolean(isVerified);
    if (currentLocation !== undefined) update.currentLocation = currentLocation;

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
        errors:  ['Driver not found'],
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Driver status updated successfully',
      data:    sanitizeDriver(driver),
    });
  } catch (err) {
    console.error('❌ updateDriverStatus error:', err);

    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid driver ID',
        errors:  ['Invalid driver ID format'],
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
      errors:  [err.message],
    });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   PUT /api/drivers/:id
//  @desc    Update driver profile details (admin)
//  @access  Private / Admin
// ════════════════════════════════════════════════════════════
exports.updateDriver = async (req, res) => {
  try {
    // Prevent password change through this route
    delete req.body.password;
    delete req.body.confirmPassword;

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
        errors:  ['Driver not found'],
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Driver updated successfully',
      data:    sanitizeDriver(driver),
    });
  } catch (err) {
    console.error('❌ updateDriver error:', err);

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: `${field} is already in use`,
        errors:  [`${field} is already in use`],
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
      errors:  [err.message],
    });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   DELETE /api/drivers/:id
//  @desc    Delete a driver  (admin only)
//  @access  Private / Admin
// ════════════════════════════════════════════════════════════
exports.deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
        errors:  ['Driver not found'],
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Driver deleted successfully',
      data:    {},
    });
  } catch (err) {
    console.error('❌ deleteDriver error:', err);

    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid driver ID',
        errors:  ['Invalid driver ID format'],
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
      errors:  [err.message],
    });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   GET /api/drivers/me
//  @desc    Get logged-in driver's own profile
//  @access  Private / Driver
// ════════════════════════════════════════════════════════════
exports.getMyProfile = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
        errors:  ['Driver not found'],
      });
    }

    return res.status(200).json({ success: true, data: sanitizeDriver(driver) });
  } catch (err) {
    console.error('❌ getMyProfile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      errors:  [err.message],
    });
  }
};