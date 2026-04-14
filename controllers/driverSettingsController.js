const Driver = require('../models/Driver');

// ─── Get Driver Settings ───────────────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id).select('settings');
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, data: driver.settings || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update All Settings ───────────────────────────────────────────────────
exports.updateAllSettings = async (req, res) => {
  try {
    const {
      newDeliveryAlert, smsConfirm, lowFuelWarn,
      autoAccept, weekends, nightShift,
      voiceNav, trafficAlerts, shareLocation, showOnlineStatus,
      pushNotifications, emailNotifications,
      preferredMaxDistance, breakTime, language,
      preferredFuelStation, preferredWorkingHours, vehicleReminders
    } = req.body;

    // Build update object dynamically — only update fields that were sent
    const update = {};
    if (newDeliveryAlert     !== undefined) update['settings.newDeliveryAlert']     = newDeliveryAlert;
    if (smsConfirm           !== undefined) update['settings.smsConfirm']           = smsConfirm;
    if (lowFuelWarn          !== undefined) update['settings.lowFuelWarn']          = lowFuelWarn;
    if (autoAccept           !== undefined) update['settings.autoAccept']           = autoAccept;
    if (weekends             !== undefined) update['settings.weekends']             = weekends;
    if (nightShift           !== undefined) update['settings.nightShift']           = nightShift;
    if (voiceNav             !== undefined) update['settings.voiceNav']             = voiceNav;
    if (trafficAlerts        !== undefined) update['settings.trafficAlerts']        = trafficAlerts;
    if (shareLocation        !== undefined) update['settings.shareLocation']        = shareLocation;
    if (showOnlineStatus     !== undefined) update['settings.showOnlineStatus']     = showOnlineStatus;
    if (pushNotifications    !== undefined) update['settings.pushNotifications']    = pushNotifications;
    if (emailNotifications   !== undefined) update['settings.emailNotifications']   = emailNotifications;
    if (preferredMaxDistance !== undefined) update['settings.preferredMaxDistance'] = preferredMaxDistance;
    if (breakTime            !== undefined) update['settings.breakTime']            = breakTime;
    if (language             !== undefined) update['settings.language']             = language;
    if (preferredFuelStation !== undefined) update['settings.preferredFuelStation'] = preferredFuelStation;
    if (preferredWorkingHours?.start) update['settings.preferredWorkingHours.start'] = preferredWorkingHours.start;
    if (preferredWorkingHours?.end)   update['settings.preferredWorkingHours.end']   = preferredWorkingHours.end;
    if (vehicleReminders?.maintenance !== undefined) update['settings.vehicleReminders.maintenance'] = vehicleReminders.maintenance;
    if (vehicleReminders?.insurance   !== undefined) update['settings.vehicleReminders.insurance']   = vehicleReminders.insurance;

    const driver = await Driver.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: false }
    ).select('settings');

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, message: 'Settings updated successfully', data: driver.settings });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Notification Settings ──────────────────────────────────────────
exports.updateNotificationSettings = async (req, res) => {
  try {
    const { newDeliveryAlert, smsConfirm, lowFuelWarn, pushNotifications, emailNotifications } = req.body;

    const update = {};
    if (newDeliveryAlert   !== undefined) update['settings.newDeliveryAlert']   = newDeliveryAlert;
    if (smsConfirm         !== undefined) update['settings.smsConfirm']         = smsConfirm;
    if (lowFuelWarn        !== undefined) update['settings.lowFuelWarn']        = lowFuelWarn;
    if (pushNotifications  !== undefined) update['settings.pushNotifications']  = pushNotifications;
    if (emailNotifications !== undefined) update['settings.emailNotifications'] = emailNotifications;

    const driver = await Driver.findByIdAndUpdate(
      req.user.id, { $set: update }, { new: true }
    ).select('settings');

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, message: 'Notification settings updated', data: driver.settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Availability Settings ──────────────────────────────────────────
exports.updateAvailabilitySettings = async (req, res) => {
  try {
    const { autoAccept, weekends, nightShift, preferredMaxDistance, preferredWorkingHours, breakTime } = req.body;

    const update = {};
    if (autoAccept           !== undefined) update['settings.autoAccept']           = autoAccept;
    if (weekends             !== undefined) update['settings.weekends']             = weekends;
    if (nightShift           !== undefined) update['settings.nightShift']           = nightShift;
    if (preferredMaxDistance !== undefined) update['settings.preferredMaxDistance'] = preferredMaxDistance;
    if (breakTime            !== undefined) update['settings.breakTime']            = breakTime;
    if (preferredWorkingHours?.start) update['settings.preferredWorkingHours.start'] = preferredWorkingHours.start;
    if (preferredWorkingHours?.end)   update['settings.preferredWorkingHours.end']   = preferredWorkingHours.end;

    const driver = await Driver.findByIdAndUpdate(
      req.user.id, { $set: update }, { new: true }
    ).select('settings');

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, message: 'Availability settings updated', data: driver.settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Navigation Settings ────────────────────────────────────────────
exports.updateNavigationSettings = async (req, res) => {
  try {
    const { voiceNav, trafficAlerts, shareLocation, showOnlineStatus } = req.body;

    const update = {};
    if (voiceNav         !== undefined) update['settings.voiceNav']         = voiceNav;
    if (trafficAlerts    !== undefined) update['settings.trafficAlerts']    = trafficAlerts;
    if (shareLocation    !== undefined) update['settings.shareLocation']    = shareLocation;
    if (showOnlineStatus !== undefined) update['settings.showOnlineStatus'] = showOnlineStatus;

    const driver = await Driver.findByIdAndUpdate(
      req.user.id, { $set: update }, { new: true }
    ).select('settings');

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, message: 'Navigation settings updated', data: driver.settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Preference Settings ────────────────────────────────────────────
exports.updatePreferenceSettings = async (req, res) => {
  try {
    const { language, preferredRoutes, preferredFuelStation } = req.body;

    const update = {};
    if (language             !== undefined) update['settings.language']             = language;
    if (preferredFuelStation !== undefined) update['settings.preferredFuelStation'] = preferredFuelStation;
    if (preferredRoutes      !== undefined) update['preferredRoutes']               = preferredRoutes;

    const driver = await Driver.findByIdAndUpdate(
      req.user.id, { $set: update }, { new: true }
    ).select('settings preferredRoutes');

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, message: 'Preference settings updated', data: driver.settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Vehicle Reminders ──────────────────────────────────────────────
exports.updateVehicleReminders = async (req, res) => {
  try {
    const { maintenance, insurance } = req.body;

    const update = {};
    if (maintenance !== undefined) update['settings.vehicleReminders.maintenance'] = maintenance;
    if (insurance   !== undefined) update['settings.vehicleReminders.insurance']   = insurance;

    const driver = await Driver.findByIdAndUpdate(
      req.user.id, { $set: update }, { new: true }
    ).select('settings');

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, message: 'Vehicle reminders updated', data: driver.settings.vehicleReminders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Reset Settings to Default ─────────────────────────────────────────────
exports.resetSettings = async (req, res) => {
  try {
    const defaultSettings = {
      newDeliveryAlert: true, smsConfirm: true, lowFuelWarn: true,
      autoAccept: false, weekends: false, nightShift: false,
      voiceNav: true, trafficAlerts: true,
      preferredMaxDistance: 20,
      preferredWorkingHours: { start: '08:00', end: '18:00' },
      breakTime: 60, language: 'English',
      pushNotifications: true, emailNotifications: true,
      shareLocation: true, showOnlineStatus: true,
      preferredFuelStation: '',
      vehicleReminders: { maintenance: true, insurance: true }
    };

    const driver = await Driver.findByIdAndUpdate(
      req.user.id,
      { $set: { settings: defaultSettings, preferredRoutes: [] } },
      { new: true }
    ).select('settings');

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, message: 'Settings reset to default', data: driver.settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Notifications ─────────────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id).select('notifications');
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, data: driver.notifications || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Mark Notification as Read ─────────────────────────────────────────────
exports.markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const driver = await Driver.findOneAndUpdate(
      { _id: req.user.id, 'notifications._id': notificationId },
      { $set: { 'notifications.$.read': true } },
      { new: true }
    );

    if (!driver) return res.status(404).json({ success: false, message: 'Driver or notification not found' });

    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Clear All Notifications ───────────────────────────────────────────────
exports.clearNotifications = async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.user.id,
      { $set: { notifications: [] } },
      { new: true }
    );

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, message: 'All notifications cleared' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Vehicle Health ─────────────────────────────────────────────────
exports.updateVehicleHealth = async (req, res) => {
  try {
    const { fuel, engine, tyres, oil } = req.body;

    const update = {};
    if (fuel   !== undefined) update['vehicleHealth.fuel']   = Math.min(100, Math.max(0, fuel));
    if (engine !== undefined) update['vehicleHealth.engine'] = Math.min(100, Math.max(0, engine));
    if (tyres  !== undefined) update['vehicleHealth.tyres']  = Math.min(100, Math.max(0, tyres));
    if (oil    !== undefined) update['vehicleHealth.oil']    = Math.min(100, Math.max(0, oil));

    const driver = await Driver.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true }
    ).select('vehicleHealth settings');

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    // Low fuel warning — add notification without triggering save hook
    if (fuel !== undefined && fuel < 20 && driver.settings?.lowFuelWarn) {
      await Driver.findByIdAndUpdate(req.user.id, {
        $push: {
          notifications: {
            $each: [{ type: 'alert', title: 'Low Fuel Warning', message: `Fuel at ${fuel}%. Refuel soon.`, read: false, createdAt: new Date() }],
            $position: 0,
            $slice: 50
          }
        }
      });
    }

    res.status(200).json({ success: true, message: 'Vehicle health updated', data: driver.vehicleHealth });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Vehicle Health ────────────────────────────────────────────────────
exports.getVehicleHealth = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id).select('vehicleHealth');
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({
      success: true,
      data: driver.vehicleHealth || { fuel: 100, engine: 100, tyres: 100, oil: 100 }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};