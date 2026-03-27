const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  credits: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['Earned', 'Spent', 'Bonus', 'Penalty'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  relatedTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  balanceAfter: {
    type: Number,
    required: true
  }
}, {
  timestamps: true // adds createdAt automatically
});

creditTransactionSchema.pre('save', function(next) {
  if (!this.transactionId) {
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.transactionId = `CTX-${Date.now().toString().slice(-6)}-${randomStr}`;
  }
  next();
});

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
