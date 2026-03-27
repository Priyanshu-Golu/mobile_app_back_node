const mongoose = require('mongoose');

const helpRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // ─── Path Type (drives Community vs Professional matching flow) ──────────
  pathType: {
    type: String,
    enum: ['community', 'professional'],
    default: 'community'
  },
  category: {
    type: String,
    enum: ['Moving Help', 'Repair', 'Emergency', 'Delivery', 'Tutoring', 'Groceries', 'Cleaning', 'Cooking', 'Pet Care', 'Tech Support', 'Other'],
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please add a title'],
    minlength: 3,
    maxlength: 100
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    minlength: 5,
    maxlength: 500
  },
  urgency: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Emergency'],
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  address: {
    type: String
  },
  status: {
    type: String,
    enum: ['Open', 'Assigned', 'In Progress', 'Completed', 'Cancelled', 'Expired'],
    default: 'Open'
  },
  estimatedDuration: {
    type: Number // in minutes
  },
  creditValue: {
    type: Number,
    default: 10,
    min: 5,
    max: 100
  },
  paymentType: {
    type: String,
    enum: ['credits', 'money', 'free'],
    default: 'credits'
  },

  // ─── Professional Path: Quotes ───────────────────────────────────────────
  quotes: [{
    professionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,
    currency: { type: String, default: 'INR' },
    message: String,
    estimatedDuration: Number, // in minutes
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
  }],
  selectedQuote: {
    type: mongoose.Schema.Types.ObjectId
  },
  requiredSkills: {
    type: [String],
    default: []
  },
  tags: {
    type: [String],
    default: []
  },
  images: {
    type: [String],
    default: []
  },
  // Track which helpers/professionals were notified
  notifiedHelperIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: []
  },

  // AI complexity score assigned by matching service
  complexityScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  }
}, {
  timestamps: true
});

// Geospatial index for nearby request lookup
helpRequestSchema.index({ location: '2dsphere' });
helpRequestSchema.index({ status: 1, createdAt: -1 });
helpRequestSchema.index({ userId: 1, status: 1 });
helpRequestSchema.index({ category: 1, urgency: 1 });

helpRequestSchema.pre('save', function(next) {
  if (!this.requestId) {
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.requestId = `REQ-${Date.now().toString().slice(-6)}-${randomStr}`;
  }
  next();
});

module.exports = mongoose.model('HelpRequest', helpRequestSchema);
