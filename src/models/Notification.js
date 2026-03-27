const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['NEW_REQUEST', 'HELPER_ACCEPTED', 'TASK_STARTED', 'TASK_COMPLETED', 'CREDITS_EARNED', 'NEW_REVIEW', 'TASK_CANCELLED', 'REMINDER'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: Object // additional payload
  },
  isRead: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    index: { expires: 0 } // MongoDB TTL index
  }
}, {
  timestamps: true // adds createdAt automatically
});

module.exports = mongoose.model('Notification', notificationSchema);
