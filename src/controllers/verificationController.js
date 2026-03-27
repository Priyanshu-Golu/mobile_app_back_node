const asyncHandler = require('../middleware/asyncHandler');
const verificationService = require('../services/verificationService');
const User = require('../models/User');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * @route   POST /api/verify/aadhaar/initiate
 * @desc    Initiate Aadhaar OTP verification
 * @access  Private
 */
exports.initiateAadhaar = asyncHandler(async (req, res) => {
  const { aadhaarNumber } = req.body;

  if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_AADHAAR', message: 'Please provide a valid 12-digit Aadhaar number' }
    });
  }

  // Check if already verified
  const user = await User.findById(req.user._id);
  if (user.verificationStatus === 'verified') {
    return res.status(400).json({
      success: false,
      error: { code: 'ALREADY_VERIFIED', message: 'Your identity is already verified' }
    });
  }

  const result = await verificationService.initiateAadhaarVerification(aadhaarNumber, req.user._id);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to initiate verification' }
    });
  }

  // Store transaction ID in Redis (10 min TTL) so we can verify OTP later
  const cacheKey = `verify:aadhaar:${req.user._id}`;
  await cacheSet(cacheKey, {
    transactionId: result.transactionId,
    mock: result.mock || false,
    aadhaarLast4: aadhaarNumber.slice(-4)
  }, 600);

  // Update user status to pending
  await User.findByIdAndUpdate(req.user._id, { verificationStatus: 'pending' });

  res.status(200).json({
    success: true,
    message: result.mock
      ? 'Mock OTP initiated. Use OTP: 123456 to verify.'
      : 'OTP sent to your Aadhaar-linked mobile number',
    data: { transactionId: result.transactionId, mock: result.mock || false }
  });
});

/**
 * @route   POST /api/verify/aadhaar/confirm
 * @desc    Confirm Aadhaar OTP and mark user as verified
 * @access  Private
 */
exports.confirmAadhaar = asyncHandler(async (req, res) => {
  const { otp } = req.body;

  if (!otp || otp.length !== 6) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_OTP', message: 'Please provide a valid 6-digit OTP' }
    });
  }

  const cacheKey = `verify:aadhaar:${req.user._id}`;
  const session = await cacheGet(cacheKey);

  if (!session) {
    return res.status(400).json({
      success: false,
      error: { code: 'SESSION_EXPIRED', message: 'Verification session expired. Please initiate again.' }
    });
  }

  const result = await verificationService.verifyAadhaarOTP(session.transactionId, otp, session.mock);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'OTP_FAILED', message: result.error || 'OTP verification failed' }
    });
  }

  // Mark user as verified
  await User.findByIdAndUpdate(req.user._id, {
    verificationStatus: 'verified',
    isVerified: true,
    verifiedAt: new Date(),
    verifiedName: result.name
  });

  // Clean up cache
  await cacheDel(cacheKey);

  logger.info(`[Verify] User ${req.user._id} successfully verified via Aadhaar`);

  res.status(200).json({
    success: true,
    message: 'Identity verified successfully',
    data: { verifiedName: result.name, verifiedAt: new Date() }
  });
});

/**
 * @route   GET /api/verify/status
 * @desc    Get current verification status for logged-in user
 * @access  Private
 */
exports.getStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('verificationStatus isVerified verifiedAt verifiedName');

  res.status(200).json({
    success: true,
    data: {
      status: user.verificationStatus || 'unverified',
      isVerified: user.isVerified || false,
      verifiedAt: user.verifiedAt || null,
      verifiedName: user.verifiedName || null
    }
  });
});
