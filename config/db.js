const dotenv = require('dotenv'); // ✅ fix typo
dotenv.config();
const mongoose = require('mongoose');

const connectdb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://patrickgowon18_db_user:HhD1GY6arVIffl5P@watersystem.8mkl44h.mongodb.net/?appName=watersystem');
    console.log('mongodb connected');
  } catch (error) {
    console.log('error connecting database');
    console.log(error);
  }
};

module.exports = connectdb;