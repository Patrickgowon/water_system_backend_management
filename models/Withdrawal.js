// models/Withdrawal.js
const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  driver: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Driver',
    required: true
  },
  amount: {
    type:     Number,
    required: true,
    min:      [1000, 'Minimum withdrawal is ₦1,000']
  },
  bankName:      { type: String, required: true },
  accountNumber: { type: String, required: true },
  accountName:   { type: String, default: ''    },
  status: {
    type:    String,
    enum:    ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNote:   { type: String, default: ''   },
  processedAt: { type: Date,   default: null },
  processedBy: { type: String, default: ''   },
}, { timestamps: true });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);