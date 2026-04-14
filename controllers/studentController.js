const User = require('../models/users');

// ─── Get all students ────────────────────────────────────────────────────────
exports.getAllStudents = async (req, res) => {
  try {
    console.log('📋 Fetching all students...');
    
    const students = await User.find({ role: 'student' })
      .select('-password -verificationToken -passwordResetToken -passwordResetExpiry')
      .sort({ createdAt: -1 });

    // Format student data
    const formattedStudents = students.map(student => ({
      id: student._id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      matricNumber: student.matricNumber,
      department: student.department,
      level: student.level,
      hall: student.hall,
      roomNumber: student.roomNumber,
      status: student.isActive ? 'active' : 'inactive',
      registeredAt: student.createdAt,
      plan: student.plan || 'Basic',
      balance: student.balance || 0,
      totalOrders: student.totalOrders || 0,
      totalSpent: student.totalSpent || 0,
      verified: student.isVerified || false
    }));

    console.log(`✅ Found ${formattedStudents.length} students`);

    res.status(200).json({
      success: true,
      count: formattedStudents.length,
      data: formattedStudents
    });
  } catch (err) {
    console.error('❌ Get all students error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Get student by ID ───────────────────────────────────────────────────────
exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await User.findOne({ _id: id, role: 'student' })
      .select('-password -verificationToken -passwordResetToken -passwordResetExpiry');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (err) {
    console.error('❌ Get student error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Add new student (Admin) ─────────────────────────────────────────────────
exports.addStudent = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      matricNumber,
      department,
      level,
      hall,
      roomNumber,
      plan
    } = req.body;

    // Check if student already exists
    const existingStudent = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { matricNumber: matricNumber?.toUpperCase() }
      ]
    });
    
    if (existingStudent) {
      return res.status(409).json({
        success: false,
        message: 'Student with this email or matric number already exists'
      });
    }

    // Generate default password
    const defaultPassword = 'student123';

    // Create new student
    const student = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      matricNumber: matricNumber?.toUpperCase(),
      department,
      level,
      hall,
      roomNumber,
      plan: plan || 'Basic',
      role: 'student',
      password: defaultPassword,
      isActive: true,
      isVerified: false,
      balance: 0,
      totalOrders: 0,
      totalSpent: 0
    });

    console.log(`✅ New student added: ${student.email}`);

    res.status(201).json({
      success: true,
      message: 'Student added successfully',
      data: {
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        matricNumber: student.matricNumber
      }
    });
  } catch (err) {
    console.error('❌ Add student error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Update student status (verify/activate) ─────────────────────────────────
exports.updateStudentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, isActive } = req.body;

    const updateData = {};
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (isActive !== undefined) updateData.isActive = isActive;

    const student = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-password');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: student
    });
  } catch (err) {
    console.error('❌ Update student error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Delete student (Admin) ──────────────────────────────────────────────────
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findByIdAndDelete(id);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    console.log(`✅ Student ${student.email} deleted successfully`);

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (err) {
    console.error('❌ Delete student error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};