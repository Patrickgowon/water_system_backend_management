// middleware/authMiddleware.js
const jwt    = require('jsonwebtoken');
const User   = require('../models/users');

// ── Try to load Driver model (may not exist yet in older projects) ────────────
let Driver;
try {
  Driver = require('../models/Driver');
} catch (_) {
  console.warn('⚠️  Driver model not found — driver auth will be skipped.');
}

// ════════════════════════════════════════════════════════════
//  protect  — verify JWT and attach req.user
//  Works for: students (role: 'student' | 'user'), admins, AND drivers
// ════════════════════════════════════════════════════════════
exports.protect = async (req, res, next) => {
  // Skip authentication for OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') return next();

  try {
    let token;

    console.log('🔐 ===== AUTH MIDDLEWARE START =====');
    console.log('🔐 Request URL:',          req.method, req.originalUrl);
    console.log('🔐 Authorization header:', req.headers.authorization);
    console.log('🔐 Cookies:',              req.cookies);

    // ── 1. Extract token ───────────────────────────────────────────────────
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('📝 Token extracted from header');
      console.log('📝 Token preview:', token ? token.substring(0, 50) + '...' : 'none');
      console.log('📝 Token length:',  token ? token.length : 0);
    } else if (req.cookies?.token) {
      token = req.cookies.token;
      console.log('📝 Token extracted from cookie');
      console.log('📝 Token preview:', token ? token.substring(0, 50) + '...' : 'none');
      console.log('📝 Token length:',  token ? token.length : 0);
    } else {
      console.log('❌ No token found in header or cookie');
    }

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({
        success: false,
        message: 'Not authenticated. Please log in.',
      });
    }

    // ── 2. Get JWT secret ─────────────────────────────────────────────────
    const jwtSecret = process.env.JWT_SECRET || 'mysecret123';

    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  WARNING: JWT_SECRET not set. Using default for development.');
    }

    console.log('🔑 Using JWT_SECRET:', jwtSecret.substring(0, 10) + '...');

    // ── 3. Verify token ───────────────────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ Token decoded successfully');
      console.log('✅ Decoded payload:', decoded);
      console.log('✅ User ID from token:', decoded.id);
      console.log('✅ Role from token:',    decoded.role || 'none (legacy token)');
    } catch (verifyError) {
      console.error('❌ Token verification failed:', verifyError.name);
      console.error('❌ Verification error:',        verifyError.message);

      if (verifyError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please log in again.',
        });
      }
      if (verifyError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please log in again.',
        });
      }
      throw verifyError;
    }

    // ── 4. Find user — check Driver model first if role says 'driver' ─────
    let user = null;

    if (decoded.role === 'driver' && Driver) {
      // Token explicitly says driver — look in Driver collection
      console.log('🚚 Looking for DRIVER with ID:', decoded.id);
      user = await Driver.findById(decoded.id);

      if (user) {
        console.log('✅ Driver found:', user.email);

        // Driver-specific status checks
        if (user.status === 'pending') {
          console.log('❌ Driver account is pending approval:', user.email);
          return res.status(403).json({
            success: false,
            message: 'Your account is pending admin approval. Please wait 24–48 hours.',
          });
        }
        if (user.status === 'suspended') {
          console.log('❌ Driver account is suspended:', user.email);
          return res.status(403).json({
            success: false,
            message: 'Your account has been suspended. Contact support.',
          });
        }
        if (user.status === 'inactive') {
          console.log('❌ Driver account is inactive:', user.email);
          return res.status(403).json({
            success: false,
            message: 'Your account is inactive. Contact support.',
          });
        }
      }
    } else {
      // Default: look in the existing User collection (students / admin)
      console.log('🔍 Looking for USER with ID:', decoded.id);
      user = await User.findById(decoded.id);

      if (user) {
        console.log('✅ User found:', user.email);

        if (user.isActive === false) {
          console.log('❌ User account is deactivated:', user.email);
          return res.status(401).json({
            success: false,
            message: 'Account has been deactivated. Contact support.',
          });
        }
      }
    }

    // ── 5. No user found in either collection ─────────────────────────────
    if (!user) {
      console.log('❌ No user found in any collection for ID:', decoded.id);
      return res.status(401).json({
        success: false,
        message: 'User no longer exists. Please register again.',
      });
    }

    console.log('✅ Authenticated successfully:', user.email);
    console.log('✅ Role:', user.role);
    console.log('🔐 ===== AUTH MIDDLEWARE END =====\n');

    req.user = user;
    next();
  } catch (err) {
    console.error('❌ Unexpected error in auth middleware:', err);
    console.error('❌ Error stack:', err.stack);
    console.log('🔐 ===== AUTH MIDDLEWARE ERROR =====\n');
    res.status(500).json({
      success: false,
      message: err.message || 'Server error during authentication.',
    });
  }
};

// ════════════════════════════════════════════════════════════
//  authorize  — restrict to specific roles  (original name kept)
//  Usage: authorize('admin')  or  authorize('admin', 'driver')
// ════════════════════════════════════════════════════════════
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Skip for CORS preflight
    if (req.method === 'OPTIONS') return next();

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    if (!roles.includes(req.user.role)) {
      console.log(
        `❌ Access denied for ${req.user.email}. ` +
        `Required: ${roles.join(' or ')}, got: ${req.user.role}`
      );
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }

    console.log(`✅ Role authorised: ${req.user.role} for ${req.user.email}`);
    next();
  };
};

// ════════════════════════════════════════════════════════════
//  restrictTo  — alias for authorize (used in driverRoutes.js)
//  Lets you use either name without changing any existing code.
//  Usage: restrictTo('admin')  or  restrictTo('admin', 'driver')
// ════════════════════════════════════════════════════════════
exports.restrictTo = (...roles) => exports.authorize(...roles);