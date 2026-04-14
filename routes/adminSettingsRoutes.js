const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  getAdminSettings,
  updateNotificationSettings,
  updateAutomationSettings,
  updateSecuritySettings,
  updateSystemSettings,
  updateAllSettings,
  resetSettings,
  updatePricing,
  updateCommission,
  resolveIncident,
  getAllIncidents,
  getPublicPricing,
} = require('../controllers/adminSettingsController');

// ✅ Public route — BEFORE any auth middleware
router.get('/pricing/public', protect, getPublicPricing);

// All routes — admin only
router.use(protect);
router.use(authorize('admin'));

// Profile
router.get('/profile',         getAdminProfile);
router.put('/profile',         updateAdminProfile);
router.put('/change-password', changeAdminPassword);

// Settings
router.get('/settings',                      getAdminSettings);
router.put('/settings',                      updateAllSettings);
router.put('/settings/reset',                resetSettings);
router.put('/settings/notifications',        updateNotificationSettings);
router.put('/settings/automation',           updateAutomationSettings);
router.put('/settings/security',             updateSecuritySettings);
router.put('/settings/system',               updateSystemSettings);
router.put('/settings/pricing',              updatePricing);
router.put('/settings/commission',           updateCommission);

// Incidents
router.get('/incidents',                                        getAllIncidents);
router.put('/drivers/:driverId/incidents/:incidentId/resolve',  resolveIncident);

module.exports = router;