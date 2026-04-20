const nodemailer = require('nodemailer');

// ─── Transporter ─────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   587,
  secure: false, // ✅ false for port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false // ✅ helps with some network restrictions
  }
});


// ─── Send OTP Email ───────────────────────────────────────────────────────────
exports.sendOTPEmail = async ({ email, firstName, otp }) => {
  try {
    await transporter.sendMail({
      from:    `"PLASU HydroTrack" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: '🔐 Your Email Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,sans-serif">
          <div style="max-width:500px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
            <div style="background:linear-gradient(135deg,#16a34a,#059669);padding:32px 24px;text-align:center">
              <h1 style="color:white;margin:0;font-size:24px">💧 PLASU HydroTrack</h1>
              <p style="color:#bbf7d0;margin:8px 0 0">Email Verification</p>
            </div>
            <div style="padding:32px 24px;text-align:center">
              <h2 style="color:#111827;margin:0 0 8px">Hi ${firstName}! 👋</h2>
              <p style="color:#6b7280;margin:0 0 24px">Enter this OTP code to verify your email address</p>
              <div style="background:#f0fdf4;border:2px dashed #16a34a;border-radius:16px;padding:24px;margin-bottom:24px">
                <p style="color:#6b7280;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.1em">Your verification code</p>
                <p style="font-size:48px;font-weight:900;color:#16a34a;margin:0;letter-spacing:12px">${otp}</p>
              </div>
              <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:12px;margin-bottom:24px">
                <p style="color:#92400e;margin:0;font-size:13px">⏰ This code expires in <strong>10 minutes</strong></p>
              </div>
              <p style="color:#9ca3af;font-size:12px">If you didn't request this, ignore this email.</p>
            </div>
            <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb">
              <p style="color:#9ca3af;font-size:12px;margin:0">PLASU HydroTrack · Plateau State University Bokkos</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    console.log(`✅ OTP email sent to ${email}`);
  } catch (err) {
    console.error('❌ OTP email error:', err.message);
    throw err;
  }
};

// ─── Send Order Approved Email to Student ────────────────────────────────────
exports.sendOrderApprovedEmail = async ({ studentEmail, studentName, deliveryDate, preferredTime, quantity, orderId, driverName, tanker }) => {
  try {
    await transporter.sendMail({
      from:    `"PLASU HydroTrack" <${process.env.EMAIL_USER}>`,
      to:      studentEmail,
      subject: '✅ Your Water Request Has Been Approved',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,sans-serif">
          <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
            
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#16a34a,#059669);padding:32px 24px;text-align:center">
              <h1 style="color:white;margin:0;font-size:24px">💧 PLASU HydroTrack</h1>
              <p style="color:#bbf7d0;margin:8px 0 0">Water Supply Management System</p>
            </div>

            <!-- Body -->
            <div style="padding:32px 24px">
              <h2 style="color:#16a34a;margin:0 0 8px">Order Approved! ✅</h2>
              <p style="color:#374151;margin:0 0 24px">Hi <strong>${studentName}</strong>, your water request has been approved and a driver has been assigned.</p>

              <!-- Order Details -->
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px">
                <h3 style="color:#15803d;margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em">Order Details</h3>
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Order ID</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">#${orderId?.slice(-6).toUpperCase()}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Quantity</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">${quantity}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Delivery Date</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">${new Date(deliveryDate).toLocaleDateString('en-NG', { dateStyle: 'full' })}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Time Slot</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">${preferredTime}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Driver</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">${driverName || 'Being assigned'}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Tanker</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">${tanker || 'Being assigned'}</td></tr>
                </table>
              </div>

              <!-- Info Box -->
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:24px">
                <p style="color:#1d4ed8;margin:0;font-size:14px">ℹ️ Please ensure someone is available at your hall room to receive the delivery during the scheduled time slot.</p>
              </div>

              <p style="color:#6b7280;font-size:13px;margin:0">If you have any questions, please contact the admin or check your dashboard.</p>
            </div>

            <!-- Footer -->
            <div style="background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb">
              <p style="color:#9ca3af;font-size:12px;margin:0">PLASU HydroTrack · Plateau State University Bokkos</p>
              <p style="color:#9ca3af;font-size:12px;margin:4px 0 0">This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    console.log(`✅ Order approved email sent to ${studentEmail}`);
  } catch (err) {
    console.error('❌ Error sending order approved email:', err.message);
  }
};

// ─── Send Driver Assignment Email ─────────────────────────────────────────────
exports.sendDriverAssignmentEmail = async ({ driverEmail, driverName, studentName, deliveryDate, preferredTime, quantity, hall, roomNumber, orderId }) => {
  try {
    await transporter.sendMail({
      from:    `"PLASU HydroTrack" <${process.env.EMAIL_USER}>`,
      to:      driverEmail,
      subject: '🚚 New Delivery Assignment',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,sans-serif">
          <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
            
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#16a34a,#059669);padding:32px 24px;text-align:center">
              <h1 style="color:white;margin:0;font-size:24px">🚚 PLASU HydroTrack</h1>
              <p style="color:#bbf7d0;margin:8px 0 0">Driver Portal</p>
            </div>

            <!-- Body -->
            <div style="padding:32px 24px">
              <h2 style="color:#16a34a;margin:0 0 8px">New Delivery Assigned! 🎯</h2>
              <p style="color:#374151;margin:0 0 24px">Hi <strong>${driverName}</strong>, you have been assigned a new water delivery. Please check the details below.</p>

              <!-- Delivery Details -->
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px">
                <h3 style="color:#15803d;margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em">Delivery Details</h3>
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Order ID</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">#${orderId?.slice(-6).toUpperCase()}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Student</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">${studentName}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Quantity</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">${quantity}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Delivery Date</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">${new Date(deliveryDate).toLocaleDateString('en-NG', { dateStyle: 'full' })}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Time Slot</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">${preferredTime}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Delivery Location</td><td style="padding:6px 0;font-weight:bold;color:#111827;font-size:14px">${hall}, Room ${roomNumber}</td></tr>
                </table>
              </div>

              <!-- Action Box -->
              <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:24px">
                <p style="color:#92400e;margin:0;font-size:14px">⚠️ Please log in to your driver dashboard to confirm and start the delivery on the scheduled date.</p>
              </div>

              <p style="color:#6b7280;font-size:13px;margin:0">Drive safe and deliver on time! 🚚</p>
            </div>

            <!-- Footer -->
            <div style="background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb">
              <p style="color:#9ca3af;font-size:12px;margin:0">PLASU HydroTrack · Plateau State University Bokkos</p>
              <p style="color:#9ca3af;font-size:12px;margin:4px 0 0">This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    console.log(`✅ Assignment email sent to driver ${driverEmail}`);
  } catch (err) {
    console.error('❌ Error sending driver assignment email:', err.message);
  }
};