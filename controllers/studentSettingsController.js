const User   = require('../models/users');
const bcrypt = require('bcryptjs');

const DEFAULT_SETTINGS = {
  deliveryAlerts:     true,
  paymentReminders:   true,
  requestUpdates:     true,
  emailNotifications: true,
  smsAlerts:          false,
  autoRenew:          false,
  consumptionTips:    true,
  darkMode:           false,
};

// ─── Get Notification Settings + In-App Notifications ────────────────────────
// ✅ Only ONE definition — the duplicate was causing the bug
exports.getNotificationSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('settings inAppNotifications');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success:       true,
      data:          { ...DEFAULT_SETTINGS, ...(user.settings || {}) },
      notifications: user.inAppNotifications || []  // ✅ broadcasts appear here
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Student Profile ───────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Student Profile ────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, hall, roomNumber } = req.body;

    if (phone && !/^[0-9]{11}$/.test(phone))
      return res.status(400).json({ success: false, message: 'Phone number must be 11 digits' });

    const update = {};
    if (firstName  !== undefined) update.firstName  = firstName.trim();
    if (lastName   !== undefined) update.lastName   = lastName.trim();
    if (phone      !== undefined) update.phone      = phone;
    if (hall       !== undefined) update.hall       = hall;
    if (roomNumber !== undefined) update.roomNumber = roomNumber.toUpperCase().trim();

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: errors[0], errors });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Change Password ───────────────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword)
      return res.status(400).json({ success: false, message: 'All password fields are required' });
    if (newPassword !== confirmPassword)
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    if (newPassword === currentPassword)
      return res.status(400).json({ success: false, message: 'New password must be different from current password' });

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
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

// ─── Get Settings ─────────────────────────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('settings');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      data: { ...DEFAULT_SETTINGS, ...(user.settings || {}) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update All Settings ──────────────────────────────────────────────────────
exports.updateAllSettings = async (req, res) => {
  try {
    const {
      deliveryAlerts, paymentReminders, requestUpdates,
      emailNotifications, smsAlerts,
      autoRenew, consumptionTips, darkMode
    } = req.body;

    const update = {};
    if (deliveryAlerts     !== undefined) update['settings.deliveryAlerts']     = deliveryAlerts;
    if (paymentReminders   !== undefined) update['settings.paymentReminders']   = paymentReminders;
    if (requestUpdates     !== undefined) update['settings.requestUpdates']     = requestUpdates;
    if (emailNotifications !== undefined) update['settings.emailNotifications'] = emailNotifications;
    if (smsAlerts          !== undefined) update['settings.smsAlerts']          = smsAlerts;
    if (autoRenew          !== undefined) update['settings.autoRenew']          = autoRenew;
    if (consumptionTips    !== undefined) update['settings.consumptionTips']    = consumptionTips;
    if (darkMode           !== undefined) update['settings.darkMode']           = darkMode;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: false }
    ).select('settings');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: { ...DEFAULT_SETTINGS, ...(user.settings || {}) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Notification Settings ─────────────────────────────────────────────
exports.updateNotificationSettings = async (req, res) => {
  try {
    const {
      deliveryAlerts, paymentReminders, requestUpdates,
      emailNotifications, smsAlerts
    } = req.body;

    const update = {};
    if (deliveryAlerts     !== undefined) update['settings.deliveryAlerts']     = deliveryAlerts;
    if (paymentReminders   !== undefined) update['settings.paymentReminders']   = paymentReminders;
    if (requestUpdates     !== undefined) update['settings.requestUpdates']     = requestUpdates;
    if (emailNotifications !== undefined) update['settings.emailNotifications'] = emailNotifications;
    if (smsAlerts          !== undefined) update['settings.smsAlerts']          = smsAlerts;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true }
    ).select('settings');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      message: 'Notification settings updated',
      data: { ...DEFAULT_SETTINGS, ...(user.settings || {}) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Preferences ───────────────────────────────────────────────────────
exports.updatePreferences = async (req, res) => {
  try {
    const { autoRenew, consumptionTips, darkMode } = req.body;

    const update = {};
    if (autoRenew       !== undefined) update['settings.autoRenew']       = autoRenew;
    if (consumptionTips !== undefined) update['settings.consumptionTips'] = consumptionTips;
    if (darkMode        !== undefined) update['settings.darkMode']        = darkMode;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true }
    ).select('settings');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      message: 'Preferences updated',
      data: { ...DEFAULT_SETTINGS, ...(user.settings || {}) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Reset Settings ───────────────────────────────────────────────────────────
exports.resetSettings = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { settings: DEFAULT_SETTINGS } },
      { new: true }
    ).select('settings');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({ success: true, message: 'Settings reset to default', data: DEFAULT_SETTINGS });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Account Stats ─────────────────────────────────────────────────────────
exports.getAccountStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('plan balance totalOrders totalSpent createdAt');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      data: {
        plan:        user.plan        || 'Basic',
        balance:     user.balance     || 0,
        totalOrders: user.totalOrders || 0,
        totalSpent:  user.totalSpent  || 0,
        memberSince: user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Delete Account ────────────────────────────────────────────────────────────
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password)
      return res.status(400).json({ success: false, message: 'Password is required to delete account' });

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Incorrect password' });

    await User.findByIdAndDelete(req.user.id);

    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};