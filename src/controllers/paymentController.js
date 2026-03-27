const asyncHandler = require('../middleware/asyncHandler');
const paymentService = require('../services/paymentService');
const analyticsService = require('../services/analyticsService');
const Task = require('../models/Task');
const CreditTransaction = require('../models/CreditTransaction');

/**
 * @route   POST /api/payments/create-order
 * @desc    Create a Razorpay payment order for a task
 * @access  Private
 */
exports.createOrder = asyncHandler(async (req, res) => {
  const { taskId, amountINR } = req.body;

  if (!taskId || !amountINR) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'taskId and amountINR are required' }
    });
  }

  // Verify task belongs to requesting user
  const task = await Task.findById(taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: { message: 'Task not found' } });
  }
  if (task.requesterId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, error: { message: 'Not authorized' } });
  }

  const order = await paymentService.createOrder(amountINR, taskId);

  res.status(200).json({
    success: true,
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      keyId: process.env.RAZORPAY_KEY_ID
    }
  });
});

/**
 * @route   POST /api/payments/verify
 * @desc    Verify Razorpay payment signature and mark task paid
 * @access  Private
 */
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { taskId, orderId, paymentId, signature } = req.body;

  const isValid = paymentService.verifySignature(orderId, paymentId, signature);
  if (!isValid) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Payment verification failed' }
    });
  }

  const task = await Task.findByIdAndUpdate(
    taskId,
    {
      paymentStatus: 'completed',
      paymentMethod: 'money',
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId
    },
    { new: true }
  );

  if (!task) {
    return res.status(404).json({ success: false, error: { message: 'Task not found' } });
  }

  analyticsService.trackPaymentProcessed(
    taskId,
    req.user._id,
    'money',
    req.body.amountINR || 0
  );

  res.status(200).json({
    success: true,
    message: 'Payment verified successfully',
    data: { task }
  });
});

/**
 * @route   GET /api/payments/history
 * @desc    Get payment & credit transaction history for user
 * @access  Private
 */
exports.getHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const query = { userId: req.user._id };
  if (type) query.type = type;

  const [transactions, total] = await Promise.all([
    CreditTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('relatedTaskId', 'taskId status'),
    CreditTransaction.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: { transactions, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
  });
});

/**
 * @route   GET /api/payments/rate
 * @desc    Get credit-to-INR conversion rate
 * @access  Public
 */
exports.getRate = asyncHandler(async (req, res) => {
  const rate = parseFloat(process.env.CREDIT_TO_INR_RATE || '1');
  res.status(200).json({ success: true, data: { creditsPerINR: 1 / rate, inrPerCredit: rate } });
});
