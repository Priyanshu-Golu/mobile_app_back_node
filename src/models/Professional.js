const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  serviceCategory: {
    type: String,
    enum: ['Plumbing', 'Electrical', 'Tutoring', 'Mechanical', 'Carpentry', 'Cleaning', 'Painting', 'IT Support', 'Other'],
    required: [true, 'Please specify your service category']
  },
  qualifications: {
    type: String,
    maxlength: [500, 'Qualifications cannot exceed 500 characters']
  },
  licenseNumber: {
    type: String
  },
  subscriptionTier: {
    type: String,
    enum: ['free', 'basic', 'premium'],
    default: 'free'
  },
  subscriptionExpiresAt: {
    type: Date
  },
  serviceRadius: {
    type: Number,
    default: 10, // kilometers
    min: 1,
    max: 50
  },
  hourlyRate: {
    type: Number,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  },
  verificationDocuments: {
    type: [String], // URLs to uploaded docs
    default: []
  },
  jobsCompleted: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  featuredUntil: {
    type: Date
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: undefined
    }
  }
}, {
  timestamps: true
});

// Geospatial index for nearby professional search
professionalSchema.index({ location: '2dsphere' });
professionalSchema.index({ serviceCategory: 1, isVerified: 1 });
professionalSchema.index({ userId: 1 });

module.exports = mongoose.model('Professional', professionalSchema);
