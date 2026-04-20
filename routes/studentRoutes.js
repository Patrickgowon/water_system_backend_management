const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/users');
const {
  getAllStudents,
  getStudentById,
  updateStudentStatus,
  addStudent,
  deleteStudent
} = require('../controllers/studentController');

router.use(protect);

// ─── Notifications ───────────────────────────────────────────────────────────
router.get('/notifications', (req, res) => {
  User.findById(req.user.id).select('notifications')
    .then(user => {
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const notifications = (user.notifications || []).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      res.status(200).json({
        success: true,
        notifications,
        data: { notifications }
      });
    })
    .catch(err => res.status(500).json({ success: false, message: err.message }));
});

router.put('/notifications/mark-read', (req, res) => {
  User.findByIdAndUpdate(req.user.id, {
    $set: { 'notifications.$[].read': true }
  })
    .then(() => res.status(200).json({ success: true, message: 'All notifications marked as read' }))
    .catch(err => res.status(500).json({ success: false, message: err.message }));
});

router.delete('/notifications', (req, res) => {
  User.findByIdAndUpdate(req.user.id, { $set: { notifications: [] } })
    .then(() => res.status(200).json({ success: true, message: 'Notifications cleared' }))
    .catch(err => res.status(500).json({ success: false, message: err.message }));
});

// ─── Admin only routes ───────────────────────────────────────────────────────
router.get('/', authorize('admin'), getAllStudents);
router.get('/:id', authorize('admin'), getStudentById);
router.put('/:id/status', authorize('admin'), updateStudentStatus);
router.post('/', authorize('admin'), addStudent);
router.delete('/:id', authorize('admin'), deleteStudent);

module.exports = router;