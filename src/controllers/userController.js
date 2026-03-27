const User = require('../models/User');
const Review = require('../models/Review');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Get current user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  // Whitelist fields — prevent role/credits/email updates via this route
  const allowedUpdates = ['name', 'phone', 'profileImage', 'bio', 'address'];
  const updates = {};
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
    runValidators: true
  });

  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Update user's skills
 * @route   PUT /api/users/skills
 * @access  Private
 */
exports.updateSkills = asyncHandler(async (req, res) => {
  const { skills } = req.body;

  if (!Array.isArray(skills)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Skills must be an array of strings' }
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { skills: skills.slice(0, 20) }, // max 20 skills
    { new: true }
  );

  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Update user location
 * @route   PUT /api/users/location
 * @access  Private
 */
exports.updateLocation = asyncHandler(async (req, res) => {
  const { coordinates } = req.body; // [longitude, latitude]

  if (
    !coordinates ||
    !Array.isArray(coordinates) ||
    coordinates.length !== 2 ||
    typeof coordinates[0] !== 'number' ||
    typeof coordinates[1] !== 'number'
  ) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_COORDINATES', message: 'Provide valid coordinates: [longitude, latitude]' }
    });
  }

  const [lng, lat] = coordinates;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return res.status(400).json({
      success: false,
      error: { code: 'OUT_OF_RANGE', message: 'Coordinates out of valid range' }
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { location: { type: 'Point', coordinates } },
    { new: true }
  );

  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Toggle helper availability
 * @route   PUT /api/users/availability
 * @access  Private
 */
exports.toggleAvailability = asyncHandler(async (req, res) => {
  const { isAvailable } = req.body;

  if (typeof isAvailable !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'isAvailable must be a boolean' }
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { isAvailable },
    { new: true }
  );

  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Get nearby available helpers
 * @route   GET /api/users/nearby-helpers
 * @access  Private
 */
exports.getNearbyHelpers = asyncHandler(async (req, res) => {
  const { lng, lat, distance = 5, skills } = req.query;

  if (!lng || !lat) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'Please provide lng and lat query params' }
    });
  }

  const radiusMeters = parseFloat(distance) * 1000;

  const matchQuery = {
    role: { $in: ['helper', 'professional'] },
    isAvailable: true,
    isActive: true
  };

  const helpers = await User.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: 'distanceMeters',
        maxDistance: radiusMeters,
        query: matchQuery,
        spherical: true
      }
    },
    {
      $project: {
        name: 1, profileImage: 1, averageRating: 1, totalReviews: 1,
        skills: 1, isAvailable: 1, role: 1, credits: 1,
        distanceMeters: 1
      }
    },
    { $limit: 20 }
  ]);

  res.status(200).json({ success: true, count: helpers.length, data: helpers });
});

/**
 * @desc    Get user details by ID (public view — no sensitive data)
 * @route   GET /api/users/:userId
 * @access  Private
 */
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId)
    .select('name profileImage averageRating totalReviews role skills bio isAvailable createdAt');

  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Get user reviews with pagination
 * @route   GET /api/users/:userId/reviews
 * @access  Private
 */
exports.getUserReviews = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find({ revieweeId: req.params.userId })
      .populate('reviewerId', 'name profileImage')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Review.countDocuments({ revieweeId: req.params.userId })
  ]);

  res.status(200).json({
    success: true,
    count: reviews.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: reviews
  });
});

/**
 * @desc    Soft-delete / deactivate account
 * @route   DELETE /api/users/account
 * @access  Private
 */
exports.deactivateAccount = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { isActive: false, isAvailable: false });
  res.status(200).json({ success: true, message: 'Account deactivated successfully' });
});
