const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [50, 'Name can not be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 8,
    select: false // Don't return password by default
  },
  phone: {
    type: String
  },
  role: {
    type: String,
    enum: ['user', 'helper', 'professional', 'admin'],
    default: 'user'
  },
  bio: {
    type: String,
    maxlength: [300, 'Bio cannot exceed 300 characters']
  },
  address: {
    type: String,
    maxlength: 200
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
  },
  credits: {
    type: Number,
    default: 50,
    min: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'pending', 'verified', 'rejected'],
    default: 'unverified'
  },
  verifiedName: String, // Name as per verified ID document

  // ─── OAuth ───────────────────────────────────────────────────────────────
  googleId: {
    type: String,
    sparse: true
  },
  isActive: {
    type: Boolean,
    default: true,
    select: false
  },
  profileImage: {
    type: String,
    default: 'default.jpg'
  },
  skills: {
    type: [String],
    default: []
  },
  fcmToken: {
    type: String,
    select: false
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  responseHistory: {
    totalRequests: { type: Number, default: 0 },
    acceptedRequests: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 } // in minutes
  },
  // ─── Payment Methods (stored card/UPI references, not raw card data) ────
  paymentMethods: [{
    type: { type: String, enum: ['card', 'upi', 'netbanking'] },
    label: String, // e.g. "HDFC ending 4532"
    razorpayTokenId: String,
    isDefault: { type: Boolean, default: false }
  }],

  resetPasswordToken: String,
  resetPasswordExpire: Date,

  // Login OTP
  loginOtp: String,
  loginOtpExpire: Date
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password token
userSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Set expire (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
