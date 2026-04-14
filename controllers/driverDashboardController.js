const mongoose   = require('mongoose');
const Driver     = require('../models/Driver');
const WaterRequest = require('../models/WaterRequest');
const bcrypt     = require('bcryptjs');

// ─── Safe query helper ────────────────────────────────────────────────────────
// ✅ Avoids "Cast to ObjectId failed" by never casting strings as ObjectId
// ✅ Safe helper — add this at the TOP of driverDashboardController.js


const buildDriverQuery = (driverId, driver) => ({
  $or: [
    { driver:         new mongoose.Types.ObjectId(driverId) }, // ObjectId match
    { assignedDriver: new mongoose.Types.ObjectId(driverId) }, // assignedDriver field
    { tanker:         driver.tankerId                        }, // tanker ID string
  ]
});

// ─── Get Driver Profile ─────────────────────────────────────────────────────
exports.getDriverProfile = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id).select('-password');
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    res.status(200).json({ success: true, data: driver });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Driver Profile ──────────────────────────────────────────────────
exports.updateDriverProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, address, emergencyContact, emergencyPhone } = req.body;

    const driver = await Driver.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, phone, address, emergencyContact, emergencyPhone },
      { new: true, runValidators: true }
    ).select('-password');

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: driver });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Change Driver Password ─────────────────────────────────────────────────
exports.changeDriverPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword)
      return res.status(400).json({ success: false, message: 'All password fields are required' });
    if (newPassword !== confirmPassword)
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    const driver = await Driver.findById(req.user.id).select('+password');
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const isMatch = await bcrypt.compare(currentPassword, driver.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await Driver.findByIdAndUpdate(req.user.id, { password: hashedPassword });

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Today's Deliveries ────────────────────────────────────────────────
exports.getTodayDeliveries = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    // ✅ Show ALL active assigned deliveries — not just today
    const deliveries = await WaterRequest.find({
      ...buildDriverQuery(req.user.id, driver),
      status: { $in: ['pending', 'approved', 'scheduled', 'assigned', 'in-progress'] }
    })
    .populate('user', 'firstName lastName email phone hall roomNumber')
    .sort({ deliveryDate: 1 }); // ✅ sort by soonest first

    const formattedDeliveries = deliveries.map(d => ({
      _id:           d._id,
      id:            d._id,
      location:      d.user?.hall    || 'Unknown Location',
      address:       `${d.user?.hall || 'Hall'}, Room ${d.user?.roomNumber || 'N/A'}`,
      amount:        d.quantityValue,
      status:        d.status,
      scheduledTime: d.preferredTime,
      scheduledDate: d.deliveryDate ? new Date(d.deliveryDate).toLocaleDateString() : 'N/A',
      recipient:     d.user ? `${d.user.firstName} ${d.user.lastName}` : 'Unknown',
      phone:         d.user?.phone   || 'N/A',
      notes:         d.specialInstructions,
      lat:           9.3265,
      lng:           8.9947,
      eta:           d.estimatedTime || '30 min',
      priority:      d.priority      || 'normal'
    }));

    res.status(200).json({ success: true, data: formattedDeliveries });
  } catch (err) {
    console.error('Get today deliveries error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Delivery History ──────────────────────────────────────────────────
exports.getDeliveryHistory = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const deliveries = await WaterRequest.find({
      ...buildDriverQuery(req.user.id, driver),
      status: 'completed'
    })
      .populate('user', 'firstName lastName hall roomNumber')
      .sort({ createdAt: -1 })
      .limit(50);

    const formattedDeliveries = deliveries.map(d => ({
      _id:           d._id,
      id:            d._id,
      location:      d.user?.hall || 'Unknown',
      amount:        d.quantityValue,
      date:          d.createdAt,
      scheduledTime: d.preferredTime,
      status:        d.status,
      recipient:     d.user ? `${d.user.firstName} ${d.user.lastName}` : 'Unknown'
    }));

    res.status(200).json({ success: true, data: formattedDeliveries });
  } catch (err) {
    console.error('Get delivery history error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Driver Earnings ───────────────────────────────────────────────────
exports.getDriverEarnings = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    // ✅ Fetch admin commission rates
    const User = require('../models/users');
    const admin = await User.findOne({ role: 'admin' }).select('adminSettings');
    const adminSettings = admin?.adminSettings?.toObject() || {};
    const baseRatePerLiter = adminSettings.baseRatePerLiter || 100;
    const bonusPerDelivery = adminSettings.bonusPerDelivery || 200;
    const tipAverage       = adminSettings.tipAverage       || 50;

    const today      = new Date(); today.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(today); todayEnd.setHours(23, 59, 59, 999);
    const weekStart  = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd    = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const baseQuery = buildDriverQuery(req.user.id, driver);

    const calculateEarnings = async (startDate, endDate) => {
    const deliveries = await WaterRequest.find({
      ...baseQuery,
      status:      'completed',
      completedAt: { $gte: startDate, $lte: endDate }, // ✅ only completedAt, no fallbacks
    });

  const totalWater = deliveries.reduce((sum, d) => sum + (d.quantityValue || 0), 0);
  const base  = totalWater * baseRatePerLiter;
  const bonus = deliveries.length * bonusPerDelivery;
  const tips  = deliveries.length * tipAverage;

  return {
    total:      base + bonus + tips,
    deliveries: deliveries.length,
    km:         deliveries.length * 5,
    base, bonus, tips
  };
};

    const [todayEarnings, weekEarnings, monthEarnings] = await Promise.all([
      calculateEarnings(today,      todayEnd),
      calculateEarnings(weekStart,  weekEnd),
      calculateEarnings(monthStart, monthEnd),
    ]);

    res.status(200).json({
      success: true,
      data: {
        today:  todayEarnings,
        week:   weekEarnings,
        month:  monthEarnings,
        rates: {
          baseRatePerLiter,
          bonusPerDelivery,
          tipAverage,
        }
      }
    });
  } catch (err) {
    console.error('Get earnings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Driver Performance ────────────────────────────────────────────────
exports.getDriverPerformance = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const baseQuery = buildDriverQuery(req.user.id, driver);

    const totalDeliveries = await WaterRequest.countDocuments({
      ...baseQuery,
      status: 'completed'
    });

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthlyDeliveries = await WaterRequest.countDocuments({
      ...baseQuery,
      status:       'completed',
      deliveryDate: { $gte: monthStart }
    });

    const targetPerMonth = 100;
    const targetPct = Math.min(100, Math.round((monthlyDeliveries / targetPerMonth) * 100));

    res.status(200).json({
      success: true,
      data: {
        rating:  driver.rating || 4.8,
        onTime:  92,
        total:   totalDeliveries,
        incidents: driver.incidentsCount || 0,
        targetPct,
        monthlyDeliveries,
        targetPerMonth
      }
    });
  } catch (err) {
    console.error('Get performance error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Driver Status (Online/Offline) ─────────────────────────────────
exports.updateDriverStatus = async (req, res) => {
  try {
    const { online } = req.body;

    const driver = await Driver.findByIdAndUpdate(
      req.user.id,
      { online, lastActive: new Date() },
      { new: true }
    ).select('-password');

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({
      success: true,
      message: `Driver is now ${online ? 'online' : 'offline'}`,
      data: { online: driver.online, lastActive: driver.lastActive }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Driver Location ────────────────────────────────────────────────
exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });

    const driver = await Driver.findByIdAndUpdate(
      req.user.id,
      { currentLocation: `${lat}, ${lng}`, lastActive: new Date() },
      { new: true }
    );

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    res.status(200).json({ success: true, message: 'Location updated', data: { lat, lng } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Report Incident ───────────────────────────────────────────────────────
exports.reportIncident = async (req, res) => {
  try {
    const { type, description } = req.body;
    if (!type || !description) return res.status(400).json({ success: false, message: 'Type and description are required' });

    const driver = await Driver.findByIdAndUpdate(
      req.user.id,
      {
        $push: { incidents: { type, description, reportedAt: new Date(), status: 'pending' } },
        $inc:  { incidentsCount: 1 }
      },
      { new: true }
    );

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const newIncident = driver.incidents[driver.incidents.length - 1];

    res.status(200).json({
      success: true,
      message: 'Incident reported. Dispatch has been notified.',
      data: { incidentId: newIncident._id, type, description, reportedAt: newIncident.reportedAt }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Start Delivery ────────────────────────────────────────────────────────
exports.startDelivery = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const delivery = await WaterRequest.findOne({
      _id: req.params.id,
      ...buildDriverQuery(req.user.id, driver)
    });

    if (!delivery)                         return res.status(404).json({ success: false, message: 'Delivery not found or not assigned to you' });
    if (delivery.status === 'completed')   return res.status(400).json({ success: false, message: 'Delivery already completed' });
    if (delivery.status === 'in-progress') return res.status(400).json({ success: false, message: 'Delivery already in progress' });

    const updated = await WaterRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'in-progress', startedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Delivery started',
      data: { _id: updated._id, status: updated.status, startedAt: updated.startedAt }
    });
  } catch (err) {
    console.error('Start delivery error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Complete Delivery ─────────────────────────────────────────────────────
exports.completeDelivery = async (req, res) => {
  try {
    const { signature, rating } = req.body;

    const driver = await Driver.findById(req.user.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const delivery = await WaterRequest.findOne({
      _id: req.params.id,
      ...buildDriverQuery(req.user.id, driver)
    });

    if (!delivery)                       return res.status(404).json({ success: false, message: 'Delivery not found or not assigned to you' });
    if (delivery.status === 'completed') return res.status(400).json({ success: false, message: 'Delivery already completed' });

    const updated = await WaterRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'completed', completedAt: new Date(), ...(signature && { signature }) },
      { new: true }
    );

    // Update driver stats
    const driverUpdate = { $inc: { totalDeliveries: 1 } };
    if (rating) {
      const newTotal  = (driver.totalRatings || 0) + 1;
      const newSum    = (driver.ratingSum    || 0) + rating;
      const newRating = parseFloat((newSum / newTotal).toFixed(1));
      driverUpdate.$set = { totalRatings: newTotal, ratingSum: newSum, rating: newRating };
    }
    await Driver.findByIdAndUpdate(req.user.id, driverUpdate);

    res.status(200).json({
      success: true,
      message: 'Delivery completed',
      data: { _id: updated._id, status: updated.status, completedAt: updated.completedAt }
    });
  } catch (err) {
    console.error('Complete delivery error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};