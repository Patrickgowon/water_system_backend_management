const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { sendBroadcast, getBroadcastHistory } = require('../controllers/broadcastController');

// Admin only
router.use(protect);
router.use(authorize('admin'));

router.post('/',       sendBroadcast);
router.get('/history', getBroadcastHistory);

module.exports = router;