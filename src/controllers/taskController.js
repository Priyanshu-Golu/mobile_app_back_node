const Task = require('../models/Task');
const HelpRequest = require('../models/HelpRequest');
const creditService = require('../services/creditService');
const notificationService = require('../services/notificationService');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Helper accepts an open request
 * @route   POST /api/tasks/accept/:requestId
 * @access  Private
 */
exports.acceptRequest = asyncHandler(async (req, res) => {
  const request = await HelpRequest.findById(req.params.requestId);

  if (!request) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } });
  }
  if (request.status !== 'Open') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'This request is no longer accepting helpers' } });
  }
  if (request.userId.toString() === req.user.id) {
    return res.status(400).json({ success: false, error: { code: 'OWN_REQUEST', message: 'You cannot accept your own request' } });
  }

  const task = await Task.create({
    requestId: request._id,
    requesterId: request.userId,
    helperId: req.user.id,
    status: 'Assigned',
    acceptedAt: new Date()
  });

  request.status = 'Assigned';
  await request.save();

  // Update helper stats
  await User.findByIdAndUpdate(req.user.id, {
    $inc: { 'responseHistory.acceptedRequests': 1 }
  });

  // Notify requester
  notificationService.sendNotification({
    userId: request.userId,
    type: 'HELPER_ACCEPTED',
    title: '🙌 A Helper Accepted Your Request!',
    message: `A helper is on their way to assist with "${request.title}".`,
    data: { taskId: task._id.toString(), requestId: request._id.toString() }
  }).catch(() => {});

  res.status(201).json({ success: true, data: task });
});

/**
 * @desc    Helper marks task as started
 * @route   PUT /api/tasks/:taskId/start
 * @access  Private (helper only)
 */
exports.startTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
  if (task.helperId.toString() !== req.user.id) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the assigned helper can start the task' } });
  if (task.status !== 'Assigned') return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Task must be in Assigned state to start' } });

  task.status = 'In Progress';
  task.startedAt = new Date();
  await task.save();

  await HelpRequest.findByIdAndUpdate(task.requestId, { status: 'In Progress' });

  notificationService.sendNotification({
    userId: task.requesterId,
    type: 'TASK_STARTED',
    title: '🔧 Your Helper Has Started the Task',
    message: 'Your helper is now working on your request.',
    data: { taskId: task._id.toString() }
  }).catch(() => {});

  res.status(200).json({ success: true, data: task });
});

/**
 * @desc    Helper marks task as complete (moves to Pending Confirmation)
 * @route   PUT /api/tasks/:taskId/complete
 * @access  Private (helper only)
 */
exports.completeTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId).populate('requestId');
  if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
  if (task.helperId.toString() !== req.user.id) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the assigned helper can mark task complete' } });
  if (task.status !== 'In Progress') return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Task must be In Progress to complete' } });

  task.status = 'Pending Confirmation';
  task.completedAt = new Date();
  await task.save();

  // Notify requester with completion code
  const taskWithCode = await Task.findById(task._id).select('+completionCode');
  notificationService.sendNotification({
    userId: task.requesterId,
    type: 'TASK_COMPLETED',
    title: '✅ Task Completed — Please Confirm!',
    message: `Your helper has completed "${task.requestId.title}". Use code ${taskWithCode.completionCode} to confirm.`,
    data: { taskId: task._id.toString(), completionCode: taskWithCode.completionCode }
  }).catch(() => {});

  res.status(200).json({ success: true, data: task, message: 'Task moved to Pending Confirmation' });
});

/**
 * @desc    Requester confirms task completion (releases credits to helper)
 * @route   PUT /api/tasks/:taskId/confirm
 * @access  Private (requester only)
 */
exports.confirmCompletion = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId).select('+completionCode').populate('requestId');
  if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
  if (task.requesterId.toString() !== req.user.id) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the requester can confirm completion' } });
  if (task.status !== 'Pending Confirmation') return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Task must be in Pending Confirmation state' } });

  const { completionCode } = req.body;
  if (completionCode && task.completionCode !== completionCode) {
    return res.status(400).json({ success: false, error: { code: 'WRONG_CODE', message: 'Completion code is incorrect' } });
  }

  task.status = 'Completed';
  await task.save();

  const request = task.requestId;
  request.status = 'Completed';
  await request.save();

  // Award credits to helper
  const creditsToEarn = request.creditValue || (request.urgency === 'Emergency' ? 20 : 10);
  await creditService.processTransaction(task.helperId, creditsToEarn, 'Earned', 'Task Completed', task._id);

  task.creditsTransacted = creditsToEarn;
  await task.save();

  await User.findByIdAndUpdate(task.helperId, {
    $inc: { 'responseHistory.completedTasks': 1 }
  });

  notificationService.sendNotification({
    userId: task.helperId,
    type: 'CREDITS_EARNED',
    title: `🎉 You Earned ${creditsToEarn} Credits!`,
    message: `The requester confirmed your help. Credits added to your account.`,
    data: { taskId: task._id.toString(), credits: creditsToEarn.toString() }
  }).catch(() => {});

  res.status(200).json({ success: true, data: task, creditsAwarded: creditsToEarn });
});

/**
 * @desc    Cancel a task
 * @route   PUT /api/tasks/:taskId/cancel
 * @access  Private (requester or helper)
 */
exports.cancelTask = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const task = await Task.findById(req.params.taskId).populate('requestId');
  if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

  const isRequester = task.requesterId.toString() === req.user.id;
  const isHelper = task.helperId.toString() === req.user.id;
  if (!isRequester && !isHelper) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });

  if (['Completed', 'Cancelled'].includes(task.status)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: `Cannot cancel a ${task.status} task` } });
  }

  const previousStatus = task.status;
  task.status = 'Cancelled';
  task.cancelledAt = new Date();
  task.cancellationReason = reason || 'No reason provided';
  await task.save();

  const request = task.requestId;

  if (isHelper) {
    // Helper cancels: penalty, re-open request
    if (previousStatus !== 'Assigned') {
      await creditService.processTransaction(req.user.id, 5, 'Penalty', 'Task Cancelled by Helper', task._id).catch(() => {});
    }
    request.status = 'Open';
    notificationService.sendNotification({
      userId: task.requesterId,
      type: 'TASK_CANCELLED',
      title: '😔 Your Helper Cancelled',
      message: `Your request "${request.title}" is back in the pool for a new helper.`,
      data: { requestId: request._id.toString() }
    }).catch(() => {});
  } else {
    // Requester cancels
    request.status = 'Cancelled';
    notificationService.sendNotification({
      userId: task.helperId,
      type: 'TASK_CANCELLED',
      title: '❌ Task Cancelled',
      message: `The requester cancelled the task "${request.title}".`,
      data: { taskId: task._id.toString() }
    }).catch(() => {});
  }

  await request.save();
  res.status(200).json({ success: true, data: task });
});

/**
 * @desc    Raise a dispute on a task
 * @route   PUT /api/tasks/:taskId/dispute
 * @access  Private (requester or helper)
 */
exports.raiseDispute = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dispute reason is required' } });
  }

  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

  const isParty = [task.requesterId.toString(), task.helperId.toString()].includes(req.user.id);
  if (!isParty) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });

  if (task.isDisputed) {
    return res.status(400).json({ success: false, error: { code: 'ALREADY_DISPUTED', message: 'A dispute has already been raised for this task' } });
  }

  task.isDisputed = true;
  task.status = 'Disputed';
  task.disputeReason = reason;
  task.disputeRaisedAt = new Date();
  task.disputeRaisedBy = req.user.id;
  await task.save();

  res.status(200).json({ success: true, message: 'Dispute raised. Our team will review within 24 hours.', data: task });
});

/**
 * @desc    Get tasks assigned to me (as helper)
 * @route   GET /api/tasks/my-tasks
 * @access  Private
 */
exports.getMyTasks = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filter = { helperId: req.user.id };
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [tasks, total] = await Promise.all([
    Task.find(filter).populate('requestId').populate('requesterId', 'name profileImage').sort('-createdAt').skip(skip).limit(parseInt(limit)),
    Task.countDocuments(filter)
  ]);

  res.status(200).json({ success: true, count: tasks.length, total, page: parseInt(page), data: tasks });
});

/**
 * @desc    Get tasks I requested
 * @route   GET /api/tasks/requested
 * @access  Private
 */
exports.getRequestedTasks = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filter = { requesterId: req.user.id };
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [tasks, total] = await Promise.all([
    Task.find(filter).populate('requestId').populate('helperId', 'name profileImage averageRating').sort('-createdAt').skip(skip).limit(parseInt(limit)),
    Task.countDocuments(filter)
  ]);

  res.status(200).json({ success: true, count: tasks.length, total, page: parseInt(page), data: tasks });
});

/**
 * @desc    Get task by ID
 * @route   GET /api/tasks/:taskId
 * @access  Private
 */
exports.getTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId)
    .populate('requestId')
    .populate('helperId', 'name profileImage averageRating phone')
    .populate('requesterId', 'name profileImage');

  if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

  // Only parties of the task can see it
  const isParty = [task.requesterId._id.toString(), task.helperId._id.toString()].includes(req.user.id);
  const isAdmin = req.user.role === 'admin';
  if (!isParty && !isAdmin) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to view this task' } });
  }

  res.status(200).json({ success: true, data: task });
});
