const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getOverview,
  getRevenueAnalytics,
  getOrderAnalytics,
  getUserAnalytics,
  getDriverAnalytics,
  getWaterAnalytics,
  getPaymentAnalytics,
  getSummary,
} = require('../controllers/analyticsController');

// All routes — admin only
router.use(protect);
router.use(authorize('admin'));

router.get('/overview',  getOverview);
router.get('/revenue',   getRevenueAnalytics);
router.get('/orders',    getOrderAnalytics);
router.get('/users',     getUserAnalytics);
router.get('/drivers',   getDriverAnalytics);
router.get('/water',     getWaterAnalytics);
router.get('/payments',  getPaymentAnalytics);
router.get('/summary',   getSummary);

module.exports = router;