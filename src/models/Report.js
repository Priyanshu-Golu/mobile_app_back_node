const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reportedTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  reportedRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HelpRequest'
  },
  reason: {
    type: String,
    enum: ['Spam', 'Harassment', 'Fraud', 'Inappropriate Content', 'No-show', 'Other'],
    required: [true, 'Please provide a reason for the report']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['Pending', 'Under Review', 'Resolved', 'Dismissed'],
    default: 'Pending'
  },
  adminNotes: {
    type: String,
    maxlength: 500
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

reportSchema.index({ reporterId: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
