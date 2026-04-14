const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getDriverProfile,
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
  getSettings,
  updateAllSettings,  // Add this import
  updateNotificationSettings,
  updateAvailabilitySettings,
  updateNavigationSettings,
  updatePreferenceSettings,
  updateVehicleReminders,
  resetSettings,
  getNotifications,
  markNotificationRead,
  clearNotifications,
  updateVehicleHealth,
  getVehicleHealth
} = require('../controllers/driverSettingsController');

// All routes require authentication
router.use(protect);

// Profile routes
router.get('/profile', getDriverProfile);
router.put('/status', updateDriverStatus);
router.put('/location', updateLocation);

// Settings routes
router.get('/settings', getSettings);
router.put('/settings', updateAllSettings);  // Add this line for updating all settings at once
router.put('/settings/reset', resetSettings);
router.put('/settings/notifications', updateNotificationSettings);
router.put('/settings/availability', updateAvailabilitySettings);
router.put('/settings/navigation', updateNavigationSettings);
router.put('/settings/preferences', updatePreferenceSettings);
router.put('/settings/vehicle-reminders', updateVehicleReminders);

// Notifications
router.get('/notifications', getNotifications);
router.put('/notifications/:notificationId/read', markNotificationRead);
router.delete('/notifications', clearNotifications);

// Vehicle health
router.get('/vehicle/health', getVehicleHealth);
router.put('/vehicle/health', updateVehicleHealth);

// Delivery routes
router.get('/deliveries/today', getTodayDeliveries);
router.get('/deliveries/history', getDeliveryHistory);
router.put('/deliveries/:id/start', startDelivery);
router.put('/deliveries/:id/complete', completeDelivery);

// Earnings and performance
router.get('/earnings', getDriverEarnings);
router.get('/performance', getDriverPerformance);

// Incident reporting
router.post('/incidents', reportIncident);

module.exports = router;