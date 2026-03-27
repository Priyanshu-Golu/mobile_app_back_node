const Professional = require('../models/Professional');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Create or update professional profile
 * @route   POST /api/professionals/profile
 * @access  Private
 */
exports.createProfile = asyncHandler(async (req, res) => {
  const existing = await Professional.findOne({ userId: req.user.id });
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'ALREADY_EXISTS', message: 'Professional profile already exists. Use PUT to update.' } });
  }

  const { serviceCategory, qualifications, licenseNumber, serviceRadius, hourlyRate, coordinates } = req.body;

  const profileData = {
    userId: req.user.id,
    serviceCategory,
    qualifications,
    licenseNumber,
    serviceRadius,
    hourlyRate
  };

  if (coordinates && coordinates.length === 2) {
    profileData.location = { type: 'Point', coordinates };
  } else if (req.user.location?.coordinates?.length === 2) {
    profileData.location = req.user.location;
  }

  const profile = await Professional.create(profileData);

  // Upgrade user role to professional
  await User.findByIdAndUpdate(req.user.id, { role: 'professional' });

  res.status(201).json({ success: true, data: profile });
});

/**
 * @desc    Get own professional profile
 * @route   GET /api/professionals/profile
 * @access  Private
 */
exports.getMyProfile = asyncHandler(async (req, res) => {
  const profile = await Professional.findOne({ userId: req.user.id }).populate('userId', 'name profileImage averageRating');
  if (!profile) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Professional profile not found' } });
  }
  res.status(200).json({ success: true, data: profile });
});

/**
 * @desc    Update professional profile
 * @route   PUT /api/professionals/profile
 * @access  Private
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const allowedUpdates = ['qualifications', 'serviceRadius', 'hourlyRate', 'licenseNumber'];
  const updates = {};
  allowedUpdates.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (req.body.coordinates?.length === 2) {
    updates.location = { type: 'Point', coordinates: req.body.coordinates };
  }

  const profile = await Professional.findOneAndUpdate({ userId: req.user.id }, updates, { new: true, runValidators: true });
  if (!profile) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Professional profile not found' } });
  }
  res.status(200).json({ success: true, data: profile });
});

/**
 * @desc    Get professional profile by user ID
 * @route   GET /api/professionals/:userId
 * @access  Public
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const profile = await Professional.findOne({ userId: req.params.userId })
    .populate('userId', 'name profileImage averageRating totalReviews');
  if (!profile) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Professional profile not found' } });
  }
  res.status(200).json({ success: true, data: profile });
});

/**
 * @desc    Get nearby professionals by service category
 * @route   GET /api/professionals/nearby
 * @access  Public
 */
exports.getNearbyProfessionals = asyncHandler(async (req, res) => {
  const { lng, lat, distance = 10, category, page = 1, limit = 10 } = req.query;

  if (!lng || !lat) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'Provide lng and lat' } });
  }

  const matchQuery = { isVerified: true };
  if (category) matchQuery.serviceCategory = category;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const results = await Professional.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: 'distanceMeters',
        maxDistance: parseFloat(distance) * 1000,
        query: matchQuery,
        spherical: true
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        pipeline: [{ $project: { name: 1, profileImage: 1, averageRating: 1, totalReviews: 1 } }],
        as: 'userId'
      }
    },
    { $unwind: '$userId' },
    { $sort: { distanceMeters: 1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: parseInt(limit) }],
        total: [{ $count: 'count' }]
      }
    }
  ]);

  const data = results[0]?.data || [];
  const total = results[0]?.total[0]?.count || 0;

  res.status(200).json({ success: true, count: data.length, total, data });
});

/**
 * @desc    Submit professional profile for verification
 * @route   POST /api/professionals/verify
 * @access  Private (professional only)
 */
exports.requestVerification = asyncHandler(async (req, res) => {
  const profile = await Professional.findOne({ userId: req.user.id });
  if (!profile) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Create a profile first' } });
  }
  if (profile.isVerified) {
    return res.status(400).json({ success: false, error: { code: 'ALREADY_VERIFIED', message: 'Profile is already verified' } });
  }
  // In production: trigger admin review workflow, send email to admin, etc.
  res.status(200).json({ success: true, message: 'Verification request submitted. Our team will review within 2-3 business days.' });
});
