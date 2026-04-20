const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');


const {
  getDriverProfile,
  updateDriverProfile,
  changeDriverPassword,
  getTodayDeliveries,
  getDeliveryHistory,
  getDriverEarnings,
  getDriverPerformance,
  startDelivery,
  completeDelivery,
  reportIncident,
  updateDriverStatus,
  updateLocation
} = require('../controllers/driverDashboardController');

const {
  getSettings,          // ← add
  updateAllSettings,    // ← add
  getNotifications,           // ← add
  markNotificationRead,       // ← add
  clearNotifications, 
} = require('../controllers/driverSettingsController');  // ← add



// All routes require authentication
router.use(protect);

// Profile routes
router.get('/profile', getDriverProfile);
router.put('/profile', updateDriverProfile);
router.put('/change-password', changeDriverPassword);
router.put('/status', updateDriverStatus);


// In your location update route
router.put('/location', protect, async (req, res) => {
  try {
    const { lat, lng, locationName } = req.body;
    await Driver.findByIdAndUpdate(req.user._id, {
      currentLat:      lat,
      currentLng:      lng,
      currentLocation: locationName || `${lat}, ${lng}`,
      lastSeen:        new Date(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ← add these two
router.get('/settings', getSettings);
router.put('/settings', updateAllSettings);

// Delivery routes
router.get('/deliveries/today', getTodayDeliveries);
router.get('/deliveries/history', getDeliveryHistory);
router.put('/deliveries/:id/start', startDelivery);
router.put('/deliveries/:id/complete', completeDelivery);


// ✅ Notification routes
router.get('/notifications',                        getNotifications);
router.put('/notifications/:notificationId/read',   markNotificationRead);
router.delete('/notifications',                     clearNotifications);

// Earnings and performance
router.get('/earnings', getDriverEarnings);
router.get('/performance', getDriverPerformance);

// Incident reporting
router.post('/incidents', reportIncident);

router.post('/withdrawal', async (req, res) => {
  try {
    const { amount, bankName, accountNumber } = req.body;
    if (!amount || !bankName || !accountNumber) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (amount < 1000) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal is ₦1,000' });
    }
    // Push withdrawal notification to driver
    await Driver.findByIdAndUpdate(req.user.id, {
      $push: {
        notifications: {
          $each: [{
            type:      'payment',
            title:     '💸 Withdrawal Request Submitted',
            message:   `Your withdrawal of ₦${amount.toLocaleString()} to ${bankName} (${accountNumber}) has been submitted and will be processed within 24 hours.`,
            read:      false,
            createdAt: new Date(),
          }],
          $position: 0,
          $slice: 50,
        }
      }
    });
    res.status(200).json({ success: true, message: 'Withdrawal request submitted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;