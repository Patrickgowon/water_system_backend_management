const WaterRequest = require('../models/WaterRequest');
const User = require('../models/users');
const Driver = require('../models/Driver');
 const { sendOrderApprovedEmail, sendDriverAssignmentEmail } = require('../utils/emailService');



// ─── Get all water requests (Admin) ─────────────────────────────────────────
exports.getAllRequests = async (req, res) => {
  try {
    console.log('📋 Fetching all water requests...');
    
    const requests = await WaterRequest.find()
      .populate('user', 'firstName lastName email matricNumber department level hall roomNumber phone')
      .populate('driver', 'firstName lastName tankerId phone rating') // ✅ Populate driver info
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${requests.length} requests`);

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (err) {
    console.error('❌ Get all requests error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Update request status (Admin) ─────────────────────────────────────────
// ─── Update request status (Admin) ─────────────────────────────────────────


exports.updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, driver, tanker, estimatedTime } = req.body;

    console.log(`📝 Updating request ${id} — status: ${status}, driver: ${driver}`);

    const request = await WaterRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const oldDriverId = request.driver ? request.driver.toString() : null;
    const newDriverId = driver          ? driver.toString()         : null;

    if (status)        request.status        = status;
    if (estimatedTime) request.estimatedTime = estimatedTime;

    // ─── Driver assignment ─────────────────────────────────────────────────
    if (driver && oldDriverId !== newDriverId) {
      request.driver         = driver;
      request.assignedDriver = driver;

      const driverDoc = await Driver.findById(driver);
      if (driverDoc) {
        request.driverName = `${driverDoc.firstName} ${driverDoc.lastName}`;
        request.tanker     = driverDoc.tankerId;

        // In-app notification → Driver
        try {
          await Driver.findByIdAndUpdate(driver, {
            $push: {
              notifications: {
                $each: [{
                  type:      'delivery',
                  title:     '🚚 New Delivery Assigned',
                  message:   `You have been assigned a delivery for ${new Date(request.deliveryDate).toLocaleDateString()} at ${request.preferredTime}.`,
                  read:      false,
                  createdAt: new Date(),
                }],
                $position: 0,
                $slice:    50,
              }
            }
          });
          console.log(`✅ In-app notification sent to driver: ${driverDoc.firstName}`);
        } catch (notifErr) {
          console.error('Driver notification error:', notifErr.message);
        }

        // In-app notification → Student (driver assigned)
        try {
          await User.findByIdAndUpdate(request.user, {
            $push: {
              inAppNotifications: {
                $each: [{
                  type:      'info',
                  title:     '🚚 Driver Assigned',
                  message:   `Driver ${driverDoc.firstName} ${driverDoc.lastName} (Tanker: ${driverDoc.tankerId}) has been assigned to your delivery on ${new Date(request.deliveryDate).toLocaleDateString()} at ${request.preferredTime}.`,
                  read:      false,
                  createdAt: new Date(),
                }],
                $position: 0,
                $slice:    50,
              }
            }
          });
          console.log(`✅ Driver assignment notification sent to student`);
        } catch (notifErr) {
          console.error('Student driver notification error:', notifErr.message);
        }

        // Email → Driver
        try {
          const studentDoc = await User.findById(request.user).select('firstName lastName hall roomNumber');
          await sendDriverAssignmentEmail({
            driverEmail:   driverDoc.email,
            driverName:    `${driverDoc.firstName} ${driverDoc.lastName}`,
            studentName:   studentDoc ? `${studentDoc.firstName} ${studentDoc.lastName}` : 'Student',
            deliveryDate:  request.deliveryDate,
            preferredTime: request.preferredTime,
            quantity:      request.quantity,
            hall:          studentDoc?.hall       || 'Hall',
            roomNumber:    studentDoc?.roomNumber || 'N/A',
            orderId:       request._id.toString(),
          });
        } catch (emailErr) {
          console.error('❌ Driver email error:', emailErr.message);
        }
      }
    } else if (tanker) {
      request.tanker = tanker;
    }

    // ─── Approval notification → Student ──────────────────────────────────
    if (status === 'approved' || status === 'assigned') {
      // In-app notification
      try {
        const driverDoc = request.driver
          ? await Driver.findById(request.driver).select('firstName lastName tankerId')
          : null;

        const notifMessage = driverDoc
          ? `Your request has been approved and assigned to driver ${driverDoc.firstName} ${driverDoc.lastName} (${driverDoc.tankerId}).`
          : `Your water request has been approved. A driver will be assigned shortly.`;

        await User.findByIdAndUpdate(request.user, {
          $push: {
            inAppNotifications: {
              $each: [{
                type:      'success',
                title:     '✅ Request Approved',
                message:   notifMessage,
                read:      false,
                createdAt: new Date(),
              }],
              $position: 0,
              $slice:    50,
            }
          }
        });
        console.log(`✅ Approval notification sent to student`);
      } catch (notifErr) {
        console.error('❌ Student approval notification error:', notifErr.message);
      }

      // Email → Student
      try {
        const studentDoc = await User.findById(request.user).select('firstName lastName email');
        const driverDoc  = request.driver
          ? await Driver.findById(request.driver).select('firstName lastName tankerId')
          : null;

        if (studentDoc?.email) {
          await sendOrderApprovedEmail({
            studentEmail:  studentDoc.email,
            studentName:   `${studentDoc.firstName} ${studentDoc.lastName}`,
            deliveryDate:  request.deliveryDate,
            preferredTime: request.preferredTime,
            quantity:      request.quantity,
            orderId:       request._id.toString(),
            driverName:    driverDoc ? `${driverDoc.firstName} ${driverDoc.lastName}` : 'Being assigned',
            tanker:        driverDoc?.tankerId || 'Being assigned',
          });
        }
      } catch (emailErr) {
        console.error('❌ Student email error:', emailErr.message);
      }
    }

    await request.save();

    const updatedRequest = await WaterRequest.findById(id)
      .populate('user',   'firstName lastName email')
      .populate('driver', 'firstName lastName tankerId');

    res.status(200).json({
      success: true,
      message: 'Request updated successfully',
      data:    updatedRequest
    });
  } catch (err) {
    console.error('❌ Update request error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Delete request (Admin) ─────────────────────────────────────────────────
exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deleting request ${id}`);

    const request = await WaterRequest.findByIdAndDelete(id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    console.log(`✅ Request ${id} deleted successfully`);

    res.status(200).json({
      success: true,
      message: 'Request deleted successfully'
    });
  } catch (err) {
    console.error('❌ Delete request error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Get request statistics (Admin) ─────────────────────────────────────────
exports.getRequestStats = async (req, res) => {
  try {
    const total = await WaterRequest.countDocuments();
    const pending = await WaterRequest.countDocuments({ status: 'pending' });
    const approved = await WaterRequest.countDocuments({ status: 'approved' });
    const inProgress = await WaterRequest.countDocuments({ status: 'in-progress' });
    const completed = await WaterRequest.countDocuments({ status: 'completed' });
    const cancelled = await WaterRequest.countDocuments({ status: 'cancelled' });

    const totalWater = await WaterRequest.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$quantityValue' } } }
    ]);

    const totalRevenue = await WaterRequest.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        approved,
        inProgress,
        completed,
        cancelled,
        totalWater: totalWater[0]?.total || 0,
        totalRevenue: totalRevenue[0]?.total || 0
      }
    });
  } catch (err) {
    console.error('❌ Get stats error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Create water request (Student) ───────────────────────────────────────
exports.createRequest = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      deliveryDate,
      preferredTime,
      quantity,
      specialInstructions,
      paymentReference,
      amount
    } = req.body;

    const request = await WaterRequest.create({
      user: userId,
      deliveryDate,
      preferredTime,
      quantity,
      specialInstructions,
      paymentReference,
      amount,
      status: 'pending',
      paymentStatus: 'paid'
    });

    res.status(201).json({
      success: true,
      message: 'Water request created successfully',
      data: request
    });

  } catch (err) {
    console.error('❌ Create request error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Get my requests (Student) ────────────────────────────────────────────
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await WaterRequest.find({ user: req.user.id })
      .populate('driver', 'firstName lastName tankerId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: requests
    });

  } catch (err) {
    console.error('❌ Get my requests error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Get single request ───────────────────────────────────────────────────
exports.getRequestById = async (req, res) => {
  try {
    const request = await WaterRequest.findById(req.params.id)
      .populate('user', 'firstName lastName email phone')
      .populate('driver', 'firstName lastName tankerId phone rating');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    res.status(200).json({
      success: true,
      data: request
    });

  } catch (err) {
    console.error('❌ Get request error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Cancel request ───────────────────────────────────────────────────────
exports.cancelRequest = async (req, res) => {
  try {
    const request = await WaterRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if user is authorized (only the student who created it or admin)
    if (request.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this request'
      });
    }

    // Only allow cancellation if status is pending or approved
    if (request.status !== 'pending' && request.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel request with status: ${request.status}`
      });
    }

    request.status = 'cancelled';
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Request cancelled successfully',
      data: request
    });

  } catch (err) {
    console.error('❌ Cancel request error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Get driver's deliveries for today (Driver) ────────────────────────────
exports.getDriverTodayDeliveries = async (req, res) => {
  try {
    const driverId = req.user.id;
    
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const deliveries = await WaterRequest.find({
  ...buildDriverQuery(req.user.id, driver),
  // deliveryDate: { $gte: today, $lt: tomorrow }, // ← commented out to test
  status: { $in: ['pending', 'approved', 'scheduled', 'assigned', 'in-progress'] }
    }).populate('user', 'firstName lastName email phone hall roomNumber');
        res.status(200).json({
      success: true,
      data: deliveries
    });
  } catch (err) {
    console.error('❌ Get driver today deliveries error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Get driver's delivery history ─────────────────────────────────────────
exports.getDriverHistory = async (req, res) => {
  try {
    const driverId = req.user.id;

    const deliveries = await WaterRequest.find({
      driver: driverId,
      status: 'completed'
    }).sort({ deliveryDate: -1 }).limit(50);

    res.status(200).json({
      success: true,
      data: deliveries
    });
  } catch (err) {
    console.error('❌ Get driver history error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Start delivery (Driver) ───────────────────────────────────────────────
exports.startDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = req.user.id;

    const request = await WaterRequest.findOne({
      _id: id,
      driver: driverId
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found or not assigned to you'
      });
    }

    if (request.status !== 'approved' && request.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: `Cannot start delivery with status: ${request.status}`
      });
    }

    request.status = 'in-progress';
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Delivery started',
      data: request
    });
  } catch (err) {
    console.error('❌ Start delivery error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Complete delivery (Driver) ────────────────────────────────────────────
exports.completeDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = req.user.id;
    const { signature } = req.body;

    const request = await WaterRequest.findOne({
      _id: id,
      driver: driverId
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found or not assigned to you'
      });
    }

    if (request.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete delivery with status: ${request.status}`
      });
    }

    request.status = 'completed';
    request.signature = signature;
    await request.save();

    // Update driver's total deliveries count
    await Driver.findByIdAndUpdate(driverId, {
      $inc: { totalDeliveries: 1 }
    });

    res.status(200).json({
      success: true,
      message: 'Delivery completed successfully',
      data: request
    });
  } catch (err) {
    console.error('❌ Complete delivery error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};