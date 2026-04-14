const User   = require('../models/users');
const bcrypt = require('bcryptjs');
const Driver = require('../models/Driver');

// ─── Default Admin Settings ───────────────────────────────────────────────────
const DEFAULT_ADMIN_SETTINGS = {
  // Notifications
  orderAlerts:      true,
  driverAlerts:     true,
  paymentAlerts:    true,
  incidentAlerts:   true,
  emailDigest:      true,
  smsAlerts:        false,
  pushAlerts:       true,
  // Automation
  autoApprove:      false,
  autoAssign:       false,
  // Security
  twoFA:            false,
  sessionTimeout:   true,
  auditLog:         true,
  // System
  maintenanceMode:         false,
  maxDeliveriesPerDriver:  8,
  defaultDeliveryWindow:   2,
  cancellationWindow:      1,
  // Pricing
  price500L:               5000,
  price1000L:              9000,
  price1500L:              12000,
  // Commission
  baseRatePerLiter:        100,
  bonusPerDelivery:        200,
  tipAverage:              50,
  commissionPercent:       15,
};

// ─── Get Admin Profile ────────────────────────────────────────────────────────
exports.getAdminProfile = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select('-password');
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    res.status(200).json({ success: true, data: admin });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Add to your adminSettingsController.js:
exports.updatePricing = async (req, res) => {
  try {
    const { price500L, price1000L, price1500L } = req.body;
    console.log('💰 Saving pricing:', { price500L, price1000L, price1500L }); // ✅ debug

    const update = {};
    if (price500L  !== undefined) update['adminSettings.price500L']  = price500L;
    if (price1000L !== undefined) update['adminSettings.price1000L'] = price1000L;
    if (price1500L !== undefined) update['adminSettings.price1500L'] = price1500L;

    console.log('📝 Update object:', update); // ✅ debug

    const admin = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true }
    ).select('adminSettings');

    console.log('✅ Saved adminSettings:', JSON.stringify(admin.adminSettings, null, 2)); // ✅ debug

    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    res.status(200).json({ success: true, message: 'Pricing updated', data: admin.adminSettings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};




// ─── Get All Incidents (Admin) ────────────────────────────────────────────────
exports.getAllIncidents = async (req, res) => {
  try {
    const drivers = await Driver.find({ 'incidents.0': { $exists: true } })
      .select('firstName lastName tankerId incidents');

    const allIncidents = [];
    drivers.forEach(driver => {
      driver.incidents.forEach(inc => {
        allIncidents.push({
          ...inc.toObject(),
          driver: {
            _id:      driver._id,
            firstName: driver.firstName,
            lastName:  driver.lastName,
            tankerId:  driver.tankerId,
          }
        });
      });
    });

    // Sort by newest first
    allIncidents.sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));

    res.status(200).json({ success: true, data: allIncidents });
  } catch (err) {
    console.error('Get all incidents error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Resolve Incident (Admin) ─────────────────────────────────────────────────
exports.resolveIncident = async (req, res) => {
  try {
    const { driverId, incidentId } = req.params;
    const { resolution } = req.body;

    const driver = await Driver.findByIdAndUpdate(
      driverId,
      {
        $set: {
          'incidents.$[inc].status':     'resolved',
          'incidents.$[inc].resolution': resolution || 'Resolved by admin',
          'incidents.$[inc].resolvedAt': new Date(),
        }
      },
      {
        arrayFilters: [{ 'inc._id': incidentId }],
        new: true
      }
    );

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, message: 'Incident resolved successfully' });
  } catch (err) {
    console.error('Resolve incident error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resolveIncident = async (req, res) => {
  try {
    const { driverId, incidentId } = req.params;
    const { resolution } = req.body;

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const incident = driver.incidents.id(incidentId);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    incident.status     = 'resolved';
    incident.resolution = resolution || 'Resolved by admin';
    incident.resolvedAt = new Date();

    await Driver.findByIdAndUpdate(driverId, {
      $set: {
        [`incidents.$[inc].status`]:     'resolved',
        [`incidents.$[inc].resolution`]: resolution || 'Resolved by admin',
        [`incidents.$[inc].resolvedAt`]: new Date(),
      }
    }, {
      arrayFilters: [{ 'inc._id': incidentId }]
    });

    res.status(200).json({ success: true, message: 'Incident resolved successfully' });
  } catch (err) {
    console.error('Resolve incident error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCommission = async (req, res) => {
  try {
    const { baseRatePerLiter, bonusPerDelivery, tipAverage, commissionPercent } = req.body;
    const update = {};
    if (baseRatePerLiter  !== undefined) update['adminSettings.baseRatePerLiter']  = baseRatePerLiter;
    if (bonusPerDelivery  !== undefined) update['adminSettings.bonusPerDelivery']  = bonusPerDelivery;
    if (tipAverage        !== undefined) update['adminSettings.tipAverage']        = tipAverage;
    if (commissionPercent !== undefined) update['adminSettings.commissionPercent'] = commissionPercent;

    const admin = await User.findByIdAndUpdate(req.user.id, { $set: update }, { new: true }).select('adminSettings');
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    res.status(200).json({ success: true, message: 'Commission updated', data: admin.adminSettings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Admin Profile ─────────────────────────────────────────────────────
exports.updateAdminProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    if (phone && !/^[0-9]{11}$/.test(phone))
      return res.status(400).json({ success: false, message: 'Phone number must be 11 digits' });

    const update = {};
    if (firstName !== undefined) update.firstName = firstName.trim();
    if (lastName  !== undefined) update.lastName  = lastName.trim();
    if (phone     !== undefined) update.phone     = phone;

    const admin = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: true }
    ).select('-password');

    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: admin
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: errors[0], errors });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Change Admin Password ────────────────────────────────────────────────────
exports.changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword)
      return res.status(400).json({ success: false, message: 'All password fields are required' });
    if (newPassword !== confirmPassword)
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    if (newPassword === currentPassword)
      return res.status(400).json({ success: false, message: 'New password must be different from current' });

    const admin = await User.findById(req.user.id).select('+password');
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    const salt   = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(newPassword, salt);
    await User.findByIdAndUpdate(req.user.id, { password: hashed });

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Admin Settings ───────────────────────────────────────────────────────
exports.getAdminSettings = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select('adminSettings');
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const savedSettings = admin.adminSettings
      ? admin.adminSettings.toObject()
      : {};

    const merged = { ...DEFAULT_ADMIN_SETTINGS, ...savedSettings };
    console.log('✅ Merged settings:', JSON.stringify(merged, null, 2));

    res.status(200).json({ success: true, data: merged });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Public Pricing (accessible by all roles) ─────────────────────────────
exports.getPublicPricing = async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' }).select('adminSettings');
    if (!admin) {
      return res.status(200).json({
        success: true,
        data: {
          price500L: 5000, price1000L: 9000, price1500L: 12000,
          baseRatePerLiter: 100, bonusPerDelivery: 200,
          tipAverage: 50, commissionPercent: 15,
        }
      });
    }
    const s = admin.adminSettings?.toObject() || {};
    res.status(200).json({
      success: true,
      data: {
        price500L:         s.price500L         || 5000,
        price1000L:        s.price1000L        || 9000,
        price1500L:        s.price1500L        || 12000,
        baseRatePerLiter:  s.baseRatePerLiter  || 100,
        bonusPerDelivery:  s.bonusPerDelivery  || 200,
        tipAverage:        s.tipAverage        || 50,
        commissionPercent: s.commissionPercent || 15,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Notification Settings ────────────────────────────────────────────
exports.updateNotificationSettings = async (req, res) => {
  try {
    const {
      orderAlerts, driverAlerts, paymentAlerts,
      incidentAlerts, emailDigest, smsAlerts, pushAlerts
    } = req.body;

    const update = {};
    if (orderAlerts    !== undefined) update['adminSettings.orderAlerts']    = orderAlerts;
    if (driverAlerts   !== undefined) update['adminSettings.driverAlerts']   = driverAlerts;
    if (paymentAlerts  !== undefined) update['adminSettings.paymentAlerts']  = paymentAlerts;
    if (incidentAlerts !== undefined) update['adminSettings.incidentAlerts'] = incidentAlerts;
    if (emailDigest    !== undefined) update['adminSettings.emailDigest']    = emailDigest;
    if (smsAlerts      !== undefined) update['adminSettings.smsAlerts']      = smsAlerts;
    if (pushAlerts     !== undefined) update['adminSettings.pushAlerts']     = pushAlerts;

    const admin = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: false }
    ).select('adminSettings');

    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    res.status(200).json({
      success: true,
      message: 'Notification settings updated',
      data: { ...DEFAULT_ADMIN_SETTINGS, ...(admin.adminSettings || {}) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Automation Settings ───────────────────────────────────────────────
exports.updateAutomationSettings = async (req, res) => {
  try {
    const { autoApprove, autoAssign } = req.body;

    const update = {};
    if (autoApprove !== undefined) update['adminSettings.autoApprove'] = autoApprove;
    if (autoAssign  !== undefined) update['adminSettings.autoAssign']  = autoAssign;

    const admin = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: false }
    ).select('adminSettings');

    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    res.status(200).json({
      success: true,
      message: 'Automation settings updated',
      data: { ...DEFAULT_ADMIN_SETTINGS, ...(admin.adminSettings || {}) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Security Settings ─────────────────────────────────────────────────
exports.updateSecuritySettings = async (req, res) => {
  try {
    const { twoFA, sessionTimeout, auditLog } = req.body;

    const update = {};
    if (twoFA          !== undefined) update['adminSettings.twoFA']          = twoFA;
    if (sessionTimeout !== undefined) update['adminSettings.sessionTimeout'] = sessionTimeout;
    if (auditLog       !== undefined) update['adminSettings.auditLog']       = auditLog;

    const admin = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: false }
    ).select('adminSettings');

    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    res.status(200).json({
      success: true,
      message: 'Security settings updated',
      data: { ...DEFAULT_ADMIN_SETTINGS, ...(admin.adminSettings || {}) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update System Settings ───────────────────────────────────────────────────
exports.updateSystemSettings = async (req, res) => {
  try {
    const {
      maintenanceMode,
      maxDeliveriesPerDriver,
      defaultDeliveryWindow,
      cancellationWindow
    } = req.body;

    const update = {};
    if (maintenanceMode        !== undefined) update['adminSettings.maintenanceMode']        = maintenanceMode;
    if (maxDeliveriesPerDriver !== undefined) update['adminSettings.maxDeliveriesPerDriver'] = maxDeliveriesPerDriver;
    if (defaultDeliveryWindow  !== undefined) update['adminSettings.defaultDeliveryWindow']  = defaultDeliveryWindow;
    if (cancellationWindow     !== undefined) update['adminSettings.cancellationWindow']     = cancellationWindow;

    const admin = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: false }
    ).select('adminSettings');

    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    res.status(200).json({
      success: true,
      message: 'System settings updated',
      data: { ...DEFAULT_ADMIN_SETTINGS, ...(admin.adminSettings || {}) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update All Settings ──────────────────────────────────────────────────────
exports.updateAllSettings = async (req, res) => {
  try {
    const {
      orderAlerts, driverAlerts, paymentAlerts, incidentAlerts,
      emailDigest, smsAlerts, pushAlerts,
      autoApprove, autoAssign,
      twoFA, sessionTimeout, auditLog,
      maintenanceMode, maxDeliveriesPerDriver,
      defaultDeliveryWindow, cancellationWindow
    } = req.body;

    const update = {};
    if (orderAlerts            !== undefined) update['adminSettings.orderAlerts']            = orderAlerts;
    if (driverAlerts           !== undefined) update['adminSettings.driverAlerts']           = driverAlerts;
    if (paymentAlerts          !== undefined) update['adminSettings.paymentAlerts']          = paymentAlerts;
    if (incidentAlerts         !== undefined) update['adminSettings.incidentAlerts']         = incidentAlerts;
    if (emailDigest            !== undefined) update['adminSettings.emailDigest']            = emailDigest;
    if (smsAlerts              !== undefined) update['adminSettings.smsAlerts']              = smsAlerts;
    if (pushAlerts             !== undefined) update['adminSettings.pushAlerts']             = pushAlerts;
    if (autoApprove            !== undefined) update['adminSettings.autoApprove']            = autoApprove;
    if (autoAssign             !== undefined) update['adminSettings.autoAssign']             = autoAssign;
    if (twoFA                  !== undefined) update['adminSettings.twoFA']                  = twoFA;
    if (sessionTimeout         !== undefined) update['adminSettings.sessionTimeout']         = sessionTimeout;
    if (auditLog               !== undefined) update['adminSettings.auditLog']               = auditLog;
    if (maintenanceMode        !== undefined) update['adminSettings.maintenanceMode']        = maintenanceMode;
    if (maxDeliveriesPerDriver !== undefined) update['adminSettings.maxDeliveriesPerDriver'] = maxDeliveriesPerDriver;
    if (defaultDeliveryWindow  !== undefined) update['adminSettings.defaultDeliveryWindow']  = defaultDeliveryWindow;
    if (cancellationWindow     !== undefined) update['adminSettings.cancellationWindow']     = cancellationWindow;

    const admin = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: false }
    ).select('adminSettings');

    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: { ...DEFAULT_ADMIN_SETTINGS, ...(admin.adminSettings || {}) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Reset Settings to Default ────────────────────────────────────────────────
exports.resetSettings = async (req, res) => {
  try {
    const admin = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { adminSettings: DEFAULT_ADMIN_SETTINGS } },
      { new: true }
    ).select('adminSettings');

    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    res.status(200).json({
      success: true,
      message: 'Settings reset to default',
      data: DEFAULT_ADMIN_SETTINGS
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};