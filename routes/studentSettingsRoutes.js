const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/users'); // ← ADD THIS
const {
  getProfile,
  updateProfile,
  changePassword,
  getNotificationSettings,
  updateNotificationSettings,
  getAccountStats,
  deleteAccount,
  getSettings,
  updateAllSettings,
  updatePreferences,
  resetSettings,
} = require('../controllers/studentSettingsController');

router.use(protect);

// ─── Profile ─────────────────────────────────────────────────────────────────
router.get('/profile',         getProfile);
router.put('/profile',         updateProfile);

// ─── Password ─────────────────────────────────────────────────────────────────
router.put('/change-password', changePassword);

// ─── In-app Notifications (the actual notification list) ──────────────────────
router.get('/notifications', (req, res) => {
  User.findById(req.user.id).select('inAppNotifications')
    .then(user => {
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const notifications = (user.inAppNotifications || []).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      res.status(200).json({
        success: true,
        notifications,          // flat — for broadcast compatibility
        data: { notifications } // nested — for approval notifications
      });
    })
    .catch(err => res.status(500).json({ success: false, message: err.message }));
});

router.put('/notifications/mark-read', (req, res) => {
  User.findByIdAndUpdate(req.user.id, {
    $set: { 'inAppNotifications.$[].read': true }
  })
    .then(() => res.status(200).json({ success: true, message: 'All marked as read' }))
    .catch(err => res.status(500).json({ success: false, message: err.message }));
});

router.delete('/notifications', (req, res) => {
  User.findByIdAndUpdate(req.user.id, { $set: { inAppNotifications: [] } })
    .then(() => res.status(200).json({ success: true, message: 'Notifications cleared' }))
    .catch(err => res.status(500).json({ success: false, message: err.message }));
});

// ─── Notification & preference settings ───────────────────────────────────────
router.put('/settings/notifications', updateNotificationSettings);
router.put('/settings/preferences',   updatePreferences);

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings',         getSettings);
router.put('/settings',         updateAllSettings);
router.put('/settings/reset',   resetSettings);

// ─── Account stats ────────────────────────────────────────────────────────────
router.get('/stats', getAccountStats);

// ─── Delete account ───────────────────────────────────────────────────────────
router.delete('/delete-account', deleteAccount);

module.exports = router;