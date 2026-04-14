const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createRequest,
  getMyRequests,
  getRequestById,
  cancelRequest,
  getAllRequests,
  updateRequestStatus,
  deleteRequest,
  getRequestStats
} = require('../controllers/waterRequestController');

// ─── All routes require authentication ──────────────────────────────────────
router.use(protect);

// ─── Student routes ─────────────────────────────────────────────────────────
router.post('/', createRequest);
router.get('/my-requests', getMyRequests);
router.get('/:id', getRequestById);
router.put('/:id/cancel', cancelRequest);

// ─── Admin only routes ──────────────────────────────────────────────────────
router.get('/admin/all', authorize('admin'), getAllRequests);
router.get('/admin/stats', authorize('admin'), getRequestStats);
router.put('/admin/:id', authorize('admin'), updateRequestStatus);
router.delete('/admin/:id', authorize('admin'), deleteRequest);

module.exports = router;