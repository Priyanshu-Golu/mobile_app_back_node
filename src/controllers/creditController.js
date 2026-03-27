const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Get credit balance
 * @route   GET /api/credits/balance
 * @access  Private
 */
exports.getBalance = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('credits');
  res.status(200).json({ success: true, credits: user.credits });
});

/**
 * @desc    Get transaction history with pagination
 * @route   GET /api/credits/transactions
 * @access  Private
 */
exports.getTransactions = asyncHandler(async (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;
  const filter = { userId: req.user.id };
  if (type) filter.type = type;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [transactions, total] = await Promise.all([
    CreditTransaction.find(filter).sort('-createdAt').skip(skip).limit(parseInt(limit)),
    CreditTransaction.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    count: transactions.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: transactions
  });
});

/**
 * @desc    Get top helpers leaderboard
 * @route   GET /api/credits/leaderboard
 * @access  Public
 */
exports.getLeaderboard = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const topHelpers = await User.find({ role: { $in: ['helper', 'professional'] } })
    .sort('-credits -averageRating')
    .limit(parseInt(limit))
    .select('name profileImage credits averageRating totalReviews role responseHistory.completedTasks');

  res.status(200).json({ success: true, data: topHelpers });
});
