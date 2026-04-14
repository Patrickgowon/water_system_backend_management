const User         = require('../models/users');
const Driver       = require('../models/Driver');
const WaterRequest = require('../models/WaterRequest');

// ─── Helper: get date range ───────────────────────────────────────────────────
const getDateRange = (period) => {
  const now   = new Date();
  const start = new Date();

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
    default:
      start.setMonth(now.getMonth() - 1); // default: last month
  }

  return { start, end: now };
};

// ─── Helper: generate last N days labels ─────────────────────────────────────
const getLastNDays = (n) => {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
};

// ─── Helper: generate last N months labels ────────────────────────────────────
const getLastNMonths = (n) => {
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
};

// ════════════════════════════════════════════════════════════
//  @route   GET /api/analytics/overview
//  @desc    Get all key metrics in one call
//  @access  Admin
// ════════════════════════════════════════════════════════════
exports.getOverview = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { start, end } = getDateRange(period);

    const [
      totalStudents,
      totalDrivers,
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      totalRevenue,
      totalWater,
      activeDrivers,
      newStudents,
      newOrders,
      periodRevenue,
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Driver.countDocuments({}),
      WaterRequest.countDocuments({}),
      WaterRequest.countDocuments({ status: 'completed' }),
      WaterRequest.countDocuments({ status: 'pending' }),
      WaterRequest.countDocuments({ status: 'cancelled' }),

      // All time revenue
      WaterRequest.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),

      // All time water delivered
      WaterRequest.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$quantityValue' } } }
      ]),

      // Active (online) drivers
      Driver.countDocuments({ online: true }),

      // New students in period
      User.countDocuments({ role: 'student', createdAt: { $gte: start, $lte: end } }),

      // New orders in period
      WaterRequest.countDocuments({ createdAt: { $gte: start, $lte: end } }),

      // Revenue in period
      WaterRequest.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
    ]);

    const completionRate = totalOrders > 0
      ? ((completedOrders / totalOrders) * 100).toFixed(1)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        // Totals
        totalStudents,
        totalDrivers,
        activeDrivers,
        totalOrders,
        completedOrders,
        pendingOrders,
        cancelledOrders,
        completionRate:  Number(completionRate),
        totalRevenue:    totalRevenue[0]?.total    || 0,
        totalWater:      totalWater[0]?.total      || 0,
        // Period metrics
        newStudents,
        newOrders,
        periodRevenue:   periodRevenue[0]?.total   || 0,
        period,
      }
    });
  } catch (err) {
    console.error('❌ Analytics overview error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   GET /api/analytics/revenue
//  @desc    Revenue over time (daily/monthly)
//  @access  Admin
// ════════════════════════════════════════════════════════════
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let groupFormat, labels;

    if (period === 'week' || period === 'today') {
      // Daily for week/today
      labels      = getLastNDays(7);
      groupFormat = '%Y-%m-%d';
    } else if (period === 'year') {
      // Monthly for year
      labels      = getLastNMonths(12);
      groupFormat = '%Y-%m';
    } else {
      // Daily for month/quarter
      labels      = getLastNDays(30);
      groupFormat = '%Y-%m-%d';
    }

    const { start } = getDateRange(period);

    const revenueData = await WaterRequest.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: start }
        }
      },
      {
        $group: {
          _id:   { $dateToString: { format: groupFormat, date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Map to labels — fill 0 for missing days
    const revenueMap = {};
    revenueData.forEach(r => { revenueMap[r._id] = { total: r.total, count: r.count }; });

    const revenues = labels.map(l => revenueMap[l]?.total || 0);
    const counts   = labels.map(l => revenueMap[l]?.count || 0);

    const totalRevenue = revenues.reduce((a, b) => a + b, 0);
    const avgRevenue   = revenues.length > 0 ? (totalRevenue / revenues.filter(r => r > 0).length || 1).toFixed(0) : 0;

    res.status(200).json({
      success: true,
      data: {
        labels,
        revenues,
        counts,
        totalRevenue,
        avgRevenue:    Number(avgRevenue),
        period,
      }
    });
  } catch (err) {
    console.error('❌ Revenue analytics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   GET /api/analytics/orders
//  @desc    Order trends and distribution
//  @access  Admin
// ════════════════════════════════════════════════════════════
exports.getOrderAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { start } = getDateRange(period);
    const labels    = getLastNDays(period === 'year' ? 30 : 7);

    // Order trend over time
    const orderTrend = await WaterRequest.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id:       { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total:     { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pending:   { $sum: { $cond: [{ $eq: ['$status', 'pending']   }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const trendMap = {};
    orderTrend.forEach(o => { trendMap[o._id] = o; });

    const trendLabels    = getLastNDays(7);
    const totalOrders    = trendLabels.map(l => trendMap[l]?.total     || 0);
    const completedOrds  = trendLabels.map(l => trendMap[l]?.completed || 0);
    const pendingOrds    = trendLabels.map(l => trendMap[l]?.pending   || 0);
    const cancelledOrds  = trendLabels.map(l => trendMap[l]?.cancelled || 0);

    // Order distribution by status
    const statusDist = await WaterRequest.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Order distribution by quantity
    const quantityDist = await WaterRequest.aggregate([
      { $group: { _id: '$quantity', count: { $sum: 1 } } }
    ]);

    // Peak delivery times
    const peakTimes = await WaterRequest.aggregate([
      { $group: { _id: '$preferredTime', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Average order value
    const avgOrderValue = await WaterRequest.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, avg: { $avg: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        trend: {
          labels:     trendLabels,
          total:      totalOrders,
          completed:  completedOrds,
          pending:    pendingOrds,
          cancelled:  cancelledOrds,
        },
        statusDistribution:   statusDist,
        quantityDistribution: quantityDist,
        peakTimes,
        avgOrderValue: avgOrderValue[0]?.avg?.toFixed(0) || 0,
        period,
      }
    });
  } catch (err) {
    console.error('❌ Order analytics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   GET /api/analytics/users
//  @desc    User growth over time
//  @access  Admin
// ════════════════════════════════════════════════════════════
exports.getUserAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const labels      = getLastNMonths(12);
    const twelveAgo   = new Date();
    twelveAgo.setMonth(twelveAgo.getMonth() - 12);

    // Student growth
    const studentGrowth = await User.aggregate([
      { $match: { role: 'student', createdAt: { $gte: twelveAgo } } },
      {
        $group: {
          _id:   { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Driver growth
    const driverGrowth = await Driver.aggregate([
      { $match: { createdAt: { $gte: twelveAgo } } },
      {
        $group: {
          _id:   { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const studentMap = {};
    studentGrowth.forEach(s => { studentMap[s._id] = s.count; });

    const driverMap = {};
    driverGrowth.forEach(d => { driverMap[d._id] = d.count; });

    const studentCounts = labels.map(l => studentMap[l] || 0);
    const driverCounts  = labels.map(l => driverMap[l]  || 0);

    // Cumulative growth
    let studentCumulative = 0;
    let driverCumulative  = 0;
    const studentCumulativeCounts = studentCounts.map(c => (studentCumulative += c));
    const driverCumulativeCounts  = driverCounts.map(c  => (driverCumulative  += c));

    // User breakdown by hall
    const hallBreakdown = await User.aggregate([
      { $match: { role: 'student', hall: { $exists: true, $ne: null } } },
      { $group: { _id: '$hall', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // User breakdown by department
    const deptBreakdown = await User.aggregate([
      { $match: { role: 'student', department: { $exists: true, $ne: null } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    // User breakdown by level
    const levelBreakdown = await User.aggregate([
      { $match: { role: 'student', level: { $exists: true, $ne: null } } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Total counts
    const [totalStudents, totalDrivers, verifiedStudents, activeDrivers] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Driver.countDocuments({}),
      User.countDocuments({ role: 'student', isVerified: true }),
      Driver.countDocuments({ status: 'active' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        labels,
        studentCounts,
        driverCounts,
        studentCumulativeCounts,
        driverCumulativeCounts,
        hallBreakdown,
        deptBreakdown,
        levelBreakdown,
        totals: {
          totalStudents,
          totalDrivers,
          verifiedStudents,
          activeDrivers,
          verificationRate: totalStudents > 0
            ? ((verifiedStudents / totalStudents) * 100).toFixed(1)
            : 0,
        },
        period,
      }
    });
  } catch (err) {
    console.error('❌ User analytics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   GET /api/analytics/drivers
//  @desc    Driver performance analytics
//  @access  Admin
// ════════════════════════════════════════════════════════════
exports.getDriverAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { start } = getDateRange(period);

    // Top performing drivers
    const topDrivers = await Driver.find({})
      .select('firstName lastName tankerId rating totalDeliveries online status vehicleType')
      .sort({ totalDeliveries: -1 })
      .limit(10);

    // Driver status breakdown
    const statusBreakdown = await Driver.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Driver online/offline
    const [onlineCount, offlineCount] = await Promise.all([
      Driver.countDocuments({ online: true }),
      Driver.countDocuments({ online: false }),
    ]);

    // Average rating
    const avgRating = await Driver.aggregate([
      { $match: { rating: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$rating' } } }
    ]);

    // Deliveries by vehicle type
    const vehicleBreakdown = await Driver.aggregate([
      { $group: { _id: '$vehicleType', count: { $sum: 1 }, totalDeliveries: { $sum: '$totalDeliveries' } } },
      { $sort: { totalDeliveries: -1 } }
    ]);

    // Incidents count
    const totalIncidents = await Driver.aggregate([
      { $group: { _id: null, total: { $sum: '$incidentsCount' } } }
    ]);

    // Experience breakdown
    const experienceBreakdown = await Driver.aggregate([
      { $group: { _id: '$yearsExperience', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        topDrivers,
        statusBreakdown,
        onlineCount,
        offlineCount,
        avgRating:          avgRating[0]?.avg?.toFixed(1)    || 0,
        vehicleBreakdown,
        totalIncidents:     totalIncidents[0]?.total          || 0,
        experienceBreakdown,
        period,
      }
    });
  } catch (err) {
    console.error('❌ Driver analytics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   GET /api/analytics/water
//  @desc    Water delivery analytics
//  @access  Admin
// ════════════════════════════════════════════════════════════
exports.getWaterAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { start } = getDateRange(period);

    // Water delivered over time
    const waterTrend = await WaterRequest.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: start } } },
      {
        $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$quantityValue' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const labels   = getLastNDays(30);
    const trendMap = {};
    waterTrend.forEach(w => { trendMap[w._id] = w; });

    const waterVolumes = labels.map(l => trendMap[l]?.total || 0);
    const orderCounts  = labels.map(l => trendMap[l]?.count || 0);

    // Total water this period
    const periodWater = waterVolumes.reduce((a, b) => a + b, 0);

    // Most popular quantity
    const quantityPopularity = await WaterRequest.aggregate([
      { $group: { _id: '$quantity', count: { $sum: 1 }, totalLiters: { $sum: '$quantityValue' } } },
      { $sort: { count: -1 } }
    ]);

    // Water by hall (which hall orders most)
    const waterByHall = await WaterRequest.aggregate([
      { $match: { status: 'completed' } },
      {
        $lookup: {
          from:         'users',
          localField:   'user',
          foreignField: '_id',
          as:           'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $group: {
          _id:        '$userInfo.hall',
          totalWater: { $sum: '$quantityValue' },
          count:      { $sum: 1 }
        }
      },
      { $sort: { totalWater: -1 } },
      { $limit: 8 }
    ]);

    // Total water all time
    const allTimeWater = await WaterRequest.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$quantityValue' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        labels,
        waterVolumes,
        orderCounts,
        periodWater,
        allTimeWater:      allTimeWater[0]?.total || 0,
        quantityPopularity,
        waterByHall,
        period,
      }
    });
  } catch (err) {
    console.error('❌ Water analytics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   GET /api/analytics/payments
//  @desc    Payment analytics
//  @access  Admin
// ════════════════════════════════════════════════════════════
exports.getPaymentAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { start } = getDateRange(period);

    // Payment status breakdown
    const paymentStatus = await WaterRequest.aggregate([
      { $group: { _id: '$paymentStatus', count: { $sum: 1 }, total: { $sum: '$amount' } } }
    ]);

    // Revenue by period
    const revenueByDay = await WaterRequest.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: start } } },
      {
        $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const labels   = getLastNDays(30);
    const trendMap = {};
    revenueByDay.forEach(r => { trendMap[r._id] = r; });
    const revenues = labels.map(l => trendMap[l]?.total || 0);

    // Total revenue
    const [totalRevenue, periodRevenue, unpaidAmount] = await Promise.all([
      WaterRequest.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      WaterRequest.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: start } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      WaterRequest.aggregate([
        { $match: { paymentStatus: 'unpaid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
    ]);

    // Average transaction value
    const avgTransaction = await WaterRequest.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, avg: { $avg: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        labels,
        revenues,
        paymentStatus,
        totalRevenue:    totalRevenue[0]?.total    || 0,
        periodRevenue:   periodRevenue[0]?.total   || 0,
        unpaidAmount:    unpaidAmount[0]?.total    || 0,
        avgTransaction:  avgTransaction[0]?.avg?.toFixed(0) || 0,
        period,
      }
    });
  } catch (err) {
    console.error('❌ Payment analytics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  @route   GET /api/analytics/summary
//  @desc    Quick summary for dashboard widgets
//  @access  Admin
// ════════════════════════════════════════════════════════════
exports.getSummary = async (req, res) => {
  try {
    const today     = new Date(); today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
    const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1); lastMonth.setDate(1); lastMonth.setHours(0, 0, 0, 0);

    const [
      todayOrders,
      todayRevenue,
      monthOrders,
      monthRevenue,
      lastMonthRevenue,
      totalStudents,
      totalDrivers,
      pendingOrders,
    ] = await Promise.all([
      WaterRequest.countDocuments({ createdAt: { $gte: today } }),
      WaterRequest.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      WaterRequest.countDocuments({ createdAt: { $gte: thisMonth } }),
      WaterRequest.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      WaterRequest.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: lastMonth, $lt: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      User.countDocuments({ role: 'student' }),
      Driver.countDocuments({}),
      WaterRequest.countDocuments({ status: 'pending' }),
    ]);

    const monthRev     = monthRevenue[0]?.total     || 0;
    const lastMonthRev = lastMonthRevenue[0]?.total  || 0;
    const revenueGrowth = lastMonthRev > 0
      ? (((monthRev - lastMonthRev) / lastMonthRev) * 100).toFixed(1)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        today: {
          orders:  todayOrders,
          revenue: todayRevenue[0]?.total || 0,
        },
        month: {
          orders:        monthOrders,
          revenue:       monthRev,
          revenueGrowth: Number(revenueGrowth),
        },
        totals: {
          students:      totalStudents,
          drivers:       totalDrivers,
          pendingOrders,
        }
      }
    });
  } catch (err) {
    console.error('❌ Summary analytics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};