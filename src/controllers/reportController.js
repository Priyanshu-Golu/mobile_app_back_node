const Report = require('../models/Report');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Submit a report
 * @route   POST /api/reports
 * @access  Private
 */
exports.createReport = asyncHandler(async (req, res) => {
  const { reason, description, reportedUserId, reportedTaskId, reportedRequestId } = req.body;

  if (!reportedUserId && !reportedTaskId && !reportedRequestId) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'At least one target (user, task, or request) must be specified' }
    });
  }

  // Prevent self-reporting
  if (reportedUserId && reportedUserId === req.user.id) {
    return res.status(400).json({
      success: false,
      error: { code: 'SELF_REPORT', message: 'You cannot report yourself' }
    });
  }

  const report = await Report.create({
    reporterId: req.user.id,
    reportedUserId,
    reportedTaskId,
    reportedRequestId,
    reason,
    description
  });

  res.status(201).json({ success: true, data: report });
});

/**
 * @desc    Get my submitted reports
 * @route   GET /api/reports/my-reports
 * @access  Private
 */
exports.getMyReports = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [reports, total] = await Promise.all([
    Report.find({ reporterId: req.user.id })
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    Report.countDocuments({ reporterId: req.user.id })
  ]);

  res.status(200).json({ success: true, count: reports.length, total, page: parseInt(page), data: reports });
});
