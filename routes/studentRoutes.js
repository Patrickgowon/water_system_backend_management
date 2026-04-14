const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllStudents,
  getStudentById,
  updateStudentStatus,
  addStudent,
  deleteStudent
} = require('../controllers/studentController');

// ─── All routes require authentication ──────────────────────────────────────
router.use(protect);

// ─── Admin only routes ──────────────────────────────────────────────────────
router.get('/', authorize('admin'), getAllStudents);
router.get('/:id', authorize('admin'), getStudentById);
router.put('/:id/status', authorize('admin'), updateStudentStatus);
router.post('/', authorize('admin'), addStudent);
router.delete('/:id', authorize('admin'), deleteStudent);

module.exports = router;