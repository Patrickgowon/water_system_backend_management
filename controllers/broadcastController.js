const User   = require('../models/users');
const Driver = require('../models/Driver');

// ─── Send Broadcast ───────────────────────────────────────────────────────────
exports.sendBroadcast = async (req, res) => {
  try {
    const { title, message, target, priority } = req.body;

    if (!title || !message)
      return res.status(400).json({ success: false, message: 'Title and message are required' });

    if (!['all', 'students', 'drivers'].includes(target))
      return res.status(400).json({ success: false, message: 'Target must be all, students, or drivers' });

    let studentCount = 0;
    let driverCount  = 0;

    // ── Push to students ──────────────────────────────────────────────────
    if (target === 'all' || target === 'students') {
      const result = await User.updateMany(
        { role: 'student', isActive: true },
        {
          $push: {
            inAppNotifications: {        // ✅ updated field name
              $each: [{
                id:        Date.now() + Math.random(),
                title,
                message,
                type:      priority === 'urgent' ? 'warning' : priority === 'high' ? 'warning' : 'info',
                priority:  priority || 'normal',
                read:      false,
                createdAt: new Date(),
              }],
              $position: 0,
              $slice: 50,
            }
          }
        }
      );
      studentCount = result.modifiedCount;
    }

    // ── Push to drivers ───────────────────────────────────────────────────
    if (target === 'all' || target === 'drivers') {
      const result = await Driver.updateMany(
        { status: { $in: ['active', 'pending'] } },
        {
          $push: {
            notifications: {
              $each: [{
                type:      priority === 'urgent' ? 'alert' : 'system',
                title,
                message,
                read:      false,
                createdAt: new Date(),
              }],
              $position: 0,
              $slice: 50,
            }
          }
        }
      );
      driverCount = result.modifiedCount;
    }

    const totalReached = studentCount + driverCount;

    console.log(`📢 Broadcast: "${title}" → ${totalReached} recipients (${studentCount} students, ${driverCount} drivers)`);

    res.status(200).json({
      success: true,
      message: `Broadcast sent to ${totalReached} recipient${totalReached !== 1 ? 's' : ''}`,
      data: {
        title,
        message,
        target,
        priority:        priority || 'normal',
        studentsReached: studentCount,
        driversReached:  driverCount,
        totalReached,
        sentAt:          new Date(),
      }
    });
  } catch (err) {
    console.error('❌ Broadcast error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─── Get Broadcast History ────────────────────────────────────────────────────
exports.getBroadcastHistory = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: [], message: 'Broadcast history retrieved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};