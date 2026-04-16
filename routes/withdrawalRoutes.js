// routes/withdrawalRoutes.js
const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  requestWithdrawal,
  getMyWithdrawals,
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
} = require('../controllers/withdrawalController');

// ── Driver routes ─────────────────────────────────────────────────────────────
router.post('/',    protect, requestWithdrawal);  // submit request
router.get('/my',   protect, getMyWithdrawals);   // get my withdrawals + balance

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get('/',               protect, authorize('admin'), getAllWithdrawals);
router.put('/:id/approve',    protect, authorize('admin'), approveWithdrawal);
router.put('/:id/reject',     protect, authorize('admin'), rejectWithdrawal);

module.exports = router;