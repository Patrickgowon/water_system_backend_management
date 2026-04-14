// backend/createAdmin.js
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./models/users');
require('dotenv').config();

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/water_supply');
    console.log('Connected to MongoDB');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      console.log('You can login with:', existingAdmin.email);
      process.exit(0);
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    // Create admin user
    const admin = await User.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@hydrosystem.com',
      phone: '08012345678',
      password: hashedPassword,
      role: 'admin',
      isVerified: true,
      isActive: true
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@hydrosystem.com');
    console.log('Password: admin123');
    console.log('Admin ID:', admin._id);
    
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
}

createAdmin();