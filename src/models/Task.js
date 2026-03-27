const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  taskId: {
    type: String,
    unique: true
  },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HelpRequest',
    required: true
  },
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  helperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Assigned', 'In Progress', 'Pending Confirmation', 'Completed', 'Cancelled', 'Disputed'],
    default: 'Assigned'
  },
  creditsTransacted: {
    type: Number,
    default: 0
  },

  // ─── Payment Info ────────────────────────────────────────────────────────
  paymentMethod: {
    type: String,
    enum: ['credits', 'money', 'free'],
    default: 'credits'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentAmount: {
    type: Number,
    default: 0
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,

  // ─── Dual Completion Confirmation (both parties must confirm) ────────────
  completionConfirmedByRequester: {
    type: Boolean,
    default: false
  },
  completionConfirmedByHelper: {
    type: Boolean,
    default: false
  },
  requesterConfirmedAt: Date,
  helperConfirmedAt: Date,

  // 4-digit confirmation code that requester gives to helper upon physical completion
  completionCode: {
    type: String,
    select: false
  },
  isDisputed: {
    type: Boolean,
    default: false
  },
  disputeReason: {
    type: String,
    maxlength: 500
  },
  disputeRaisedAt: {
    type: Date
  },
  disputeRaisedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acceptedAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancellationReason: String
}, {
  timestamps: true
});

taskSchema.index({ helperId: 1, status: 1 });
taskSchema.index({ requesterId: 1, status: 1 });
taskSchema.index({ requestId: 1 });

taskSchema.pre('save', function(next) {
  if (!this.taskId) {
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.taskId = `TSK-${Date.now().toString().slice(-6)}-${randomStr}`;
  }
  // Generate completion code if not set
  if (!this.completionCode) {
    this.completionCode = Math.floor(1000 + Math.random() * 9000).toString();
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);
