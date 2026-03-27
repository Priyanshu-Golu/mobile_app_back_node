const User = require('../models/User');
const HelpRequest = require('../models/HelpRequest');
const Task = require('../models/Task');
const Report = require('../models/Report');
const Professional = require('../models/Professional');
const CreditTransaction = require('../models/CreditTransaction');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Get dashboard stats
 * @route   GET /api/admin/stats
 * @access  Admin
 */
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalUsers, totalRequests, totalTasks, totalProfessionals,
    openRequests, completedTasks, pendingReports,
    totalCreditsTransacted
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    HelpRequest.countDocuments(),
    Task.countDocuments(),
    Professional.countDocuments(),
    HelpRequest.countDocuments({ status: 'Open' }),
    Task.countDocuments({ status: 'Completed' }),
    Report.countDocuments({ status: 'Pending' }),
    CreditTransaction.aggregate([
      { $match: { type: 'Earned' } },
      { $group: { _id: null, total: { $sum: '$credits' } } }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      users: { total: totalUsers },
      requests: { total: totalRequests, open: openRequests },
      tasks: { total: totalTasks, completed: completedTasks },
      professionals: { total: totalProfessionals },
      reports: { pending: pendingReports },
      credits: { totalTransacted: totalCreditsTransacted[0]?.total || 0 }
    }
  });
});

/**
 * @desc    Get all users with search & filter
 * @route   GET /api/admin/users
 * @access  Admin
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
  const { role, isActive, search, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } }
  ];

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [users, total] = await Promise.all([
    User.find(filter).select('+isActive').sort('-createdAt').skip(skip).limit(parseInt(limit)),
    User.countDocuments(filter)
  ]);

  res.status(200).json({ success: true, count: users.length, total, page: parseInt(page), data: users });
});

/**
 * @desc    Ban or unban a user
 * @route   PUT /api/admin/users/:userId/status
 * @access  Admin
 */
exports.updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'isActive must be a boolean' } });
  }

  const user = await User.findByIdAndUpdate(req.params.userId, { isActive }, { new: true });
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  res.status(200).json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: user
  });
});

/**
 * @desc    Get all reports
 * @route   GET /api/admin/reports
 * @access  Admin
 */
exports.getAllReports = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [reports, total] = await Promise.all([
    Report.find(filter)
      .populate('reporterId', 'name email')
      .populate('reportedUserId', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    Report.countDocuments(filter)
  ]);

  res.status(200).json({ success: true, count: reports.length, total, page: parseInt(page), data: reports });
});

/**
 * @desc    Resolve a report
 * @route   PUT /api/admin/reports/:reportId/resolve
 * @access  Admin
 */
exports.resolveReport = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;
  const validStatuses = ['Resolved', 'Dismissed', 'Under Review'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` } });
  }

  const report = await Report.findByIdAndUpdate(
    req.params.reportId,
    { status, adminNotes, resolvedAt: status === 'Resolved' ? new Date() : undefined, resolvedBy: req.user.id },
    { new: true }
  );

  if (!report) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } });
  res.status(200).json({ success: true, data: report });
});

/**
 * @desc    Verify a professional
 * @route   PUT /api/admin/professionals/:userId/verify
 * @access  Admin
 */
exports.verifyProfessional = asyncHandler(async (req, res) => {
  const profile = await Professional.findOneAndUpdate(
    { userId: req.params.userId },
    { isVerified: true, verifiedAt: new Date() },
    { new: true }
  );

  if (!profile) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Professional profile not found' } });

  await User.findByIdAndUpdate(req.params.userId, { isVerified: true, verifiedAt: new Date() });

  res.status(200).json({ success: true, message: 'Professional verified successfully', data: profile });
});

/**
 * @desc    Get all tasks (admin)
 * @route   GET /api/admin/tasks
 * @access  Admin
 */
exports.getAllTasks = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate('requestId', 'title category urgency')
      .populate('requesterId', 'name email')
      .populate('helperId', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    Task.countDocuments(filter)
  ]);

  res.status(200).json({ success: true, count: tasks.length, total, page: parseInt(page), data: tasks });
});
