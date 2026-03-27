const HelpRequest = require('../models/HelpRequest');
const matchingService = require('../services/matchingService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Create a new help request
 * @route   POST /api/requests
 * @access  Private
 */
exports.createRequest = asyncHandler(async (req, res) => {
  const { title, description, category, urgency, coordinates, address, estimatedDuration, creditValue, paymentType, requiredSkills, tags } = req.body;

  const requestData = {
    userId: req.user.id,
    title,
    description,
    category,
    urgency,
    address,
    estimatedDuration,
    creditValue,
    paymentType,
    requiredSkills: requiredSkills || [],
    tags: tags || [],
    location: { type: 'Point', coordinates }
  };

  const request = await HelpRequest.create(requestData);

  // Trigger matching & notifications asynchronously (don't block response)
  setImmediate(() => {
    matchingService.findAndNotifyMatches(request).catch(err =>
      console.error('[Request] Matching error:', err.message)
    );
  });

  res.status(201).json({ success: true, data: request });
});

/**
 * @desc    Get all requests with filters and pagination
 * @route   GET /api/requests
 * @access  Public
 */
exports.getRequests = asyncHandler(async (req, res) => {
  const { status, category, urgency, page = 1, limit = 10, sort = '-createdAt' } = req.query;
  const filter = {};

  if (status) filter.status = status;
  if (category) filter.category = category;
  if (urgency) filter.urgency = urgency;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [requests, total] = await Promise.all([
    HelpRequest.find(filter)
      .populate('userId', 'name profileImage averageRating')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    HelpRequest.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    count: requests.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: requests
  });
});

/**
 * @desc    Get user's own requests with pagination
 * @route   GET /api/requests/my-requests
 * @access  Private
 */
exports.getMyRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filter = { userId: req.user.id };
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [requests, total] = await Promise.all([
    HelpRequest.find(filter).sort('-createdAt').skip(skip).limit(parseInt(limit)),
    HelpRequest.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    count: requests.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: requests
  });
});

/**
 * @desc    Get nearby open requests (for helpers)
 * @route   GET /api/requests/nearby
 * @access  Private
 */
exports.getNearbyRequests = asyncHandler(async (req, res) => {
  const { lng, lat, distance = 5, category, urgency, page = 1, limit = 10 } = req.query;

  if (!lng || !lat) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'Please provide lng and lat query parameters' }
    });
  }

  const radiusMeters = parseFloat(distance) * 1000;
  const matchFilter = { status: 'Open' };
  if (category) matchFilter.category = category;
  if (urgency) matchFilter.urgency = urgency;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const pipeline = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: 'distanceMeters',
        maxDistance: radiusMeters,
        query: matchFilter,
        spherical: true
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        pipeline: [{ $project: { name: 1, profileImage: 1, averageRating: 1 } }],
        as: 'userId'
      }
    },
    { $unwind: '$userId' },
    { $sort: { urgency: -1, distanceMeters: 1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: parseInt(limit) }],
        total: [{ $count: 'count' }]
      }
    }
  ];

  const result = await HelpRequest.aggregate(pipeline);
  const data = result[0]?.data || [];
  const total = result[0]?.total[0]?.count || 0;

  res.status(200).json({
    success: true,
    count: data.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data
  });
});

/**
 * @desc    Get specific request details
 * @route   GET /api/requests/:requestId
 * @access  Public
 */
exports.getRequest = asyncHandler(async (req, res) => {
  const request = await HelpRequest.findById(req.params.requestId)
    .populate('userId', 'name profileImage averageRating totalReviews');

  if (!request) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } });
  }

  res.status(200).json({ success: true, data: request });
});

/**
 * @desc    Update own request
 * @route   PUT /api/requests/:requestId
 * @access  Private
 */
exports.updateRequest = asyncHandler(async (req, res) => {
  let request = await HelpRequest.findById(req.params.requestId);

  if (!request) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } });
  }

  if (request.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to update this request' } });
  }

  // Only allow updates if still Open
  if (!['Open'].includes(request.status)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATE', message: 'Can only update Open requests' }
    });
  }

  const allowedUpdates = ['title', 'description', 'urgency', 'estimatedDuration', 'address', 'images'];
  const updates = {};
  allowedUpdates.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  request = await HelpRequest.findByIdAndUpdate(req.params.requestId, updates, {
    new: true,
    runValidators: true
  });

  res.status(200).json({ success: true, data: request });
});

/**
 * @desc    Cancel a request
 * @route   DELETE /api/requests/:requestId
 * @access  Private
 */
exports.deleteRequest = asyncHandler(async (req, res) => {
  const request = await HelpRequest.findById(req.params.requestId);

  if (!request) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } });
  }

  if (request.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to cancel this request' } });
  }

  if (['Completed', 'Cancelled'].includes(request.status)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATE', message: `Cannot cancel a ${request.status} request` }
    });
  }

  request.status = 'Cancelled';
  await request.save();

  res.status(200).json({ success: true, message: 'Request cancelled successfully' });
});
