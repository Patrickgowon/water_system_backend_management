// controllers/withdrawalController.js
const mongoose   = require('mongoose');
const Withdrawal = require('../models/Withdrawal');
const Driver     = require('../models/Driver');
const WaterRequest = require('../models/WaterRequest');
const nodemailer = require('nodemailer');

// ─── Email transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false }
});

// ─── Helper: get driver total earnings from completed deliveries ──────────────
const getDriverTotalEarnings = async (driverId) => {
  try {
    const driver = await Driver.findById(driverId);
    if (!driver) return 0;

    const User  = require('../models/users');
    const admin = await User.findOne({ role: 'admin' }).select('adminSettings');
    const s     = admin?.adminSettings?.toObject() || {};

    const baseRatePerLiter = s.baseRatePerLiter || 100;
    const bonusPerDelivery = s.bonusPerDelivery || 200;
    const tipAverage       = s.tipAverage       || 50;

    const deliveries = await WaterRequest.find({
      $or: [
        { driver:         new mongoose.Types.ObjectId(driverId) },
        { assignedDriver: new mongoose.Types.ObjectId(driverId) },
        { tanker:         driver.tankerId },
      ],
      status:      'completed',
      completedAt: { $exists: true, $ne: null }
    });

    const totalWater = deliveries.reduce((sum, d) => sum + (d.quantityValue || 0), 0);
    return (totalWater * baseRatePerLiter) +
           (deliveries.length * bonusPerDelivery) +
           (deliveries.length * tipAverage);
  } catch (err) {
    console.error('getDriverTotalEarnings error:', err.message);
    return 0;
  }
};

// ─── Helper: get total already withdrawn (approved only) ─────────────────────
const getTotalWithdrawn = async (driverId) => {
  try {
    const result = await Withdrawal.aggregate([
      { $match: { driver: new mongoose.Types.ObjectId(driverId), status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    return result[0]?.total || 0;
  } catch (err) {
    return 0;
  }
};

// ─── Helper: send email ───────────────────────────────────────────────────────
const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"PLASU HydroTrack" <${process.env.EMAIL_USER}>`,
      to, subject, html
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Email error: ${err.message}`);
  }
};

// ════════════════════════════════════════════════════════════
//  DRIVER: Submit withdrawal request
//  POST /api/withdrawals
// ════════════════════════════════════════════════════════════
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, bankName, accountNumber, accountName } = req.body;
    const driverId = req.user.id;

    if (!amount || !bankName || !accountNumber)
      return res.status(400).json({ success: false, message: 'Amount, bank name and account number are required' });
    if (Number(amount) < 1000)
      return res.status(400).json({ success: false, message: 'Minimum withdrawal is ₦1,000' });

    // ✅ Calculate available balance
    const totalEarnings    = await getDriverTotalEarnings(driverId);
    const totalWithdrawn   = await getTotalWithdrawn(driverId);
    const availableBalance = totalEarnings - totalWithdrawn;

    console.log(`💰 Driver ${driverId} — Earnings: ₦${totalEarnings}, Withdrawn: ₦${totalWithdrawn}, Available: ₦${availableBalance}`);

    if (Number(amount) > availableBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₦${availableBalance.toLocaleString()}`
      });
    }

    // ✅ Block if pending withdrawal exists
    const pending = await Withdrawal.findOne({ driver: driverId, status: 'pending' });
    if (pending)
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request. Please wait for it to be processed.'
      });

    const withdrawal = await Withdrawal.create({
      driver:        driverId,
      amount:        Number(amount),
      bankName,
      accountNumber,
      accountName:   accountName || '',
    });

    // ✅ Push in-app notification to driver
    await Driver.findByIdAndUpdate(driverId, {
      $push: {
        notifications: {
          $each: [{
            type:      'payment',
            title:     '💸 Withdrawal Request Submitted',
            message:   `Your withdrawal of ₦${Number(amount).toLocaleString()} to ${bankName} (${accountNumber}) has been submitted and is awaiting admin approval.`,
            read:      false,
            createdAt: new Date(),
          }],
          $position: 0,
          $slice:    50,
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully. Admin will review it shortly.',
      data: {
        ...withdrawal.toObject(),
        availableBalance,
        totalEarnings,
        totalWithdrawn,
      }
    });
  } catch (err) {
    console.error('requestWithdrawal error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  DRIVER: Get my withdrawals + balance summary
//  GET /api/withdrawals/my
// ════════════════════════════════════════════════════════════
exports.getMyWithdrawals = async (req, res) => {
  try {
    const driverId = req.user.id;

    const [withdrawals, totalEarnings, totalWithdrawn] = await Promise.all([
      Withdrawal.find({ driver: driverId }).sort({ createdAt: -1 }),
      getDriverTotalEarnings(driverId),
      getTotalWithdrawn(driverId),
    ]);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        totalEarnings,
        totalWithdrawn,
        availableBalance: Math.max(0, totalEarnings - totalWithdrawn),
      }
    });
  } catch (err) {
    console.error('getMyWithdrawals error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  ADMIN: Get all withdrawals
//  GET /api/withdrawals
// ════════════════════════════════════════════════════════════
exports.getAllWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = (status && status !== 'all') ? { status } : {};

    const withdrawals = await Withdrawal.find(filter)
      .populate('driver', 'firstName lastName email tankerId phone')
      .sort({ createdAt: -1 });

    // ✅ Attach driver balance to each withdrawal
    const enriched = await Promise.all(
      withdrawals.map(async (w) => {
        const driverId       = w.driver?._id || w.driver;
        const totalEarnings  = await getDriverTotalEarnings(driverId);
        const totalWithdrawn = await getTotalWithdrawn(driverId);
        return {
          ...w.toObject(),
          driverBalance: {
            totalEarnings,
            totalWithdrawn,
            available: Math.max(0, totalEarnings - totalWithdrawn),
          }
        };
      })
    );

    const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
    const totalPending = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + w.amount, 0);

    res.status(200).json({
      success: true,
      data:    enriched,
      summary: { pendingCount, totalPending }
    });
  } catch (err) {
    console.error('getAllWithdrawals error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  ADMIN: Approve withdrawal
//  PUT /api/withdrawals/:id/approve
// ════════════════════════════════════════════════════════════
exports.approveWithdrawal = async (req, res) => {
  try {
    const { id }        = req.params;
    const { adminNote } = req.body;

    const withdrawal = await Withdrawal.findById(id)
      .populate('driver', 'firstName lastName email phone tankerId');

    if (!withdrawal)
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending')
      return res.status(400).json({ success: false, message: 'Withdrawal already processed' });

    // ✅ Re-verify balance before approving
    const totalEarnings  = await getDriverTotalEarnings(withdrawal.driver._id);
    const totalWithdrawn = await getTotalWithdrawn(withdrawal.driver._id);
    const available      = Math.max(0, totalEarnings - totalWithdrawn);

    if (withdrawal.amount > available) {
      return res.status(400).json({
        success: false,
        message: `Driver balance insufficient. Available: ₦${available.toLocaleString()}, Requested: ₦${withdrawal.amount.toLocaleString()}`
      });
    }

    withdrawal.status      = 'approved';
    withdrawal.adminNote   = adminNote || 'Payment processed';
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // ✅ Push in-app notification to driver
    await Driver.findByIdAndUpdate(withdrawal.driver._id, {
      $push: {
        notifications: {
          $each: [{
            type:      'payment',
            title:     '✅ Withdrawal Approved!',
            message:   `Your withdrawal of ₦${withdrawal.amount.toLocaleString()} to ${withdrawal.bankName} (${withdrawal.accountNumber}) has been approved and payment sent.`,
            read:      false,
            createdAt: new Date(),
          }],
          $position: 0,
          $slice:    50,
        }
      }
    });

    // ✅ Send approval email to driver
    await sendEmail(
      withdrawal.driver.email,
      '✅ Withdrawal Approved - PLASU HydroTrack',
      `
      <div style="max-width:500px;margin:0 auto;font-family:Arial,sans-serif;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
        <div style="background:linear-gradient(135deg,#16a34a,#059669);padding:24px;text-align:center">
          <h1 style="color:white;margin:0;font-size:22px">💧 PLASU HydroTrack</h1>
        </div>
        <div style="padding:32px;text-align:center">
          <div style="font-size:60px;margin-bottom:16px">✅</div>
          <h2 style="color:#16a34a;margin:0 0 8px">Withdrawal Approved!</h2>
          <p style="color:#374151">Hi <strong>${withdrawal.driver.firstName}</strong>, your withdrawal has been approved and payment sent.</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0;text-align:left">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#6b7280;padding:6px 0;font-size:14px">Amount</td><td style="font-weight:bold;text-align:right;font-size:14px">₦${withdrawal.amount.toLocaleString()}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0;font-size:14px">Bank</td><td style="font-weight:bold;text-align:right;font-size:14px">${withdrawal.bankName}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0;font-size:14px">Account</td><td style="font-weight:bold;text-align:right;font-size:14px">${withdrawal.accountNumber}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0;font-size:14px">Date</td><td style="font-weight:bold;text-align:right;font-size:14px">${new Date().toLocaleDateString('en-NG', { dateStyle: 'full' })}</td></tr>
              ${adminNote ? `<tr><td style="color:#6b7280;padding:6px 0;font-size:14px">Note</td><td style="font-weight:bold;text-align:right;font-size:14px">${adminNote}</td></tr>` : ''}
            </table>
          </div>
          <p style="color:#6b7280;font-size:13px">Keep delivering and earning! 🚚</p>
        </div>
        <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:12px;margin:0">PLASU HydroTrack · Plateau State University Bokkos</p>
        </div>
      </div>
      `
    );

    res.status(200).json({
      success: true,
      message: 'Withdrawal approved. Driver has been notified via app and email.',
      data:    withdrawal
    });
  } catch (err) {
    console.error('approveWithdrawal error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════
//  ADMIN: Reject withdrawal
//  PUT /api/withdrawals/:id/reject
// ════════════════════════════════════════════════════════════
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { id }        = req.params;
    const { adminNote } = req.body;

    const withdrawal = await Withdrawal.findById(id)
      .populate('driver', 'firstName lastName email');

    if (!withdrawal)
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending')
      return res.status(400).json({ success: false, message: 'Withdrawal already processed' });

    withdrawal.status      = 'rejected';
    withdrawal.adminNote   = adminNote || 'Rejected by admin';
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // ✅ Push in-app notification to driver
    await Driver.findByIdAndUpdate(withdrawal.driver._id, {
      $push: {
        notifications: {
          $each: [{
            type:      'payment',
            title:     '❌ Withdrawal Rejected',
            message:   `Your withdrawal of ₦${withdrawal.amount.toLocaleString()} was rejected. Reason: ${adminNote || 'Contact admin for details.'}`,
            read:      false,
            createdAt: new Date(),
          }],
          $position: 0,
          $slice:    50,
        }
      }
    });

    // ✅ Send rejection email
    await sendEmail(
      withdrawal.driver.email,
      '❌ Withdrawal Rejected - PLASU HydroTrack',
      `
      <div style="max-width:500px;margin:0 auto;font-family:Arial,sans-serif;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
        <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:24px;text-align:center">
          <h1 style="color:white;margin:0;font-size:22px">💧 PLASU HydroTrack</h1>
        </div>
        <div style="padding:32px;text-align:center">
          <div style="font-size:60px;margin-bottom:16px">❌</div>
          <h2 style="color:#dc2626;margin:0 0 8px">Withdrawal Rejected</h2>
          <p style="color:#374151">Hi <strong>${withdrawal.driver.firstName}</strong>, your withdrawal request was not approved at this time.</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin:20px 0;text-align:left">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#6b7280;padding:6px 0;font-size:14px">Amount</td><td style="font-weight:bold;text-align:right;font-size:14px">₦${withdrawal.amount.toLocaleString()}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0;font-size:14px">Bank</td><td style="font-weight:bold;text-align:right;font-size:14px">${withdrawal.bankName}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0;font-size:14px">Reason</td><td style="font-weight:bold;text-align:right;font-size:14px;color:#dc2626">${adminNote || 'Contact admin'}</td></tr>
            </table>
          </div>
          <p style="color:#6b7280;font-size:13px">You can submit a new withdrawal request after resolving the issue. Contact admin if you have questions.</p>
        </div>
        <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:12px;margin:0">PLASU HydroTrack · Plateau State University Bokkos</p>
        </div>
      </div>
      `
    );

    res.status(200).json({
      success: true,
      message: 'Withdrawal rejected. Driver has been notified.',
      data:    withdrawal
    });
  } catch (err) {
    console.error('rejectWithdrawal error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};