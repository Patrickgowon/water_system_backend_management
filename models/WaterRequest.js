const mongoose = require('mongoose');

const waterRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deliveryDate: {
    type: Date,
    required: true
  },
  preferredTime: {
    type: String,
    required: true,
    enum: ['08:00 - 10:00', '10:00 - 12:00', '12:00 - 14:00', '14:00 - 16:00', '16:00 - 18:00']
  },
  quantity: {
    type: String,
    required: true,
    enum: ['500 Liters (Standard)', '1000 Liters (Large)', '1500 Liters (Extra Large)'],
    default: '500 Liters (Standard)'
  },
  quantityValue: {
    type: Number,
    default: 500
  },
  specialInstructions: {
    type: String,
    maxlength: 500,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'assigned', 'in-progress', 'completed', 'cancelled', 'approved'],
    default: 'pending'
  },
  tanker: {
    type: String,
    default: 'Not assigned'
  },
  
  // ✅ CHANGE: driver now references Driver model by ObjectId
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  driverName: {
    type: String,
    default: 'Not assigned'
  },
  estimatedTime: {
    type: String,
    default: 'Pending'
  },
  paymentReference: {
    type: String,
    default: null
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'refunded'],
    default: 'unpaid'
  },
  amount: {
    type: Number,
    default: 0
  },
  // ─── Add these fields to your WaterRequest model (models/WaterRequest.js)
// Add them before the closing of the schema, before { timestamps: true }

assignedDriver: {
  type:    mongoose.Schema.Types.ObjectId,
  ref:     'Driver',
  default: null
},

startedAt: {
  type: Date,
  default: null
},
completedAt: {
  type: Date,
  default: null
},
signature: {
  type:    String,
  default: null
},

}, { timestamps: true });


// Auto-compute quantityValue from quantity string before saving
waterRequestSchema.pre('save', function () {
  const map = {
    '500 Liters (Standard)':   500,
    '1000 Liters (Large)':     1000,
    '1500 Liters (Extra Large)': 1500,
  };
  if (this.quantity) {
    this.quantityValue = map[this.quantity] || 500;
  }
});

module.exports = mongoose.model('WaterRequest', waterRequestSchema);