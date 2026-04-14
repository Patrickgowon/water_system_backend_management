const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Controllers
const driverController = require('../controllers/driverController');
const driverDashboardController = require('../controllers/driverDashboardController');
const driverSettingsController = require('../controllers/driverSettingsController');
const incidentController = require('../controllers/incidentController');




// ============ PUBLIC ROUTES ============
router.post('/driver/register', driverController.registerDriver);
router.post('/driver/login', driverController.loginDriver);


// ============ PROTECTED ROUTES ============
router.use(protect);


// ============ DRIVER CRUD / ADMIN ============
router.get('/', driverController.getAllDrivers);
router.get('/:id', driverController.getDriverById);
router.put('/:id/status', driverController.updateDriverStatus);
router.put('/:id', driverController.updateDriver);
router.delete('/:id', driverController.deleteDriver);


// ============ PROFILE ============
router.get('/me', driverController.getMyProfile);


// ============ DASHBOARD ============
router.put('/status', driverDashboardController.updateDriverStatus);
router.put('/location', driverDashboardController.updateLocation);


// ============ SETTINGS ============
router.get('/settings', driverSettingsController.getSettings);
router.put('/settings', driverSettingsController.updateAllSettings);
router.put('/settings/reset', driverSettingsController.resetSettings);
router.put('/settings/notifications', driverSettingsController.updateNotificationSettings);
router.put('/settings/availability', driverSettingsController.updateAvailabilitySettings);
router.put('/settings/navigation', driverSettingsController.updateNavigationSettings);
router.put('/settings/preferences', driverSettingsController.updatePreferenceSettings);
router.put('/settings/vehicle-reminders', driverSettingsController.updateVehicleReminders);


// ============ NOTIFICATIONS ============
router.get('/notifications', driverSettingsController.getNotifications);
router.put('/notifications/:notificationId/read', driverSettingsController.markNotificationRead);
router.delete('/notifications', driverSettingsController.clearNotifications);


// ============ VEHICLE ============
router.get('/vehicle/health', driverSettingsController.getVehicleHealth);
router.put('/vehicle/health', driverSettingsController.updateVehicleHealth);


// ============ DELIVERIES ============
router.get('/deliveries/today', driverDashboardController.getTodayDeliveries);
router.get('/deliveries/history', driverDashboardController.getDeliveryHistory);
router.put('/deliveries/:id/start', driverDashboardController.startDelivery);
router.put('/deliveries/:id/complete', driverDashboardController.completeDelivery);


// ============ EARNINGS ============
router.get('/earnings', driverDashboardController.getDriverEarnings);
router.get('/performance', driverDashboardController.getDriverPerformance);


// INCIDENT ROUTES (ADMIN FIRST)
router.get('/admin/incidents', incidentController.getAllIncidents);

// INCIDENT ROUTES (DRIVER)
router.post('/incidents', incidentController.reportIncident);
router.get('/incidents', incidentController.getMyIncidents);
router.get('/incidents/:incidentId', incidentController.getIncidentById);

// RESOLVE INCIDENT
router.put(
  '/incidents/:driverId/:incidentId/resolve',
  incidentController.resolveIncident
);



module.exports = router;