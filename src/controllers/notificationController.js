const Notification = require('../models/Notification');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Get all notifications for current user, newest first
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ userId: req.user.id }).sort('-createdAt').skip(skip).limit(parseInt(limit)),
    Notification.countDocuments({ userId: req.user.id }),
    Notification.countDocuments({ userId: req.user.id, isRead: false })
  ]);

  res.status(200).json({
    success: true,
    count: notifications.length,
    total,
    unreadCount,
    page: parseInt(page),
    data: notifications
  });
});

/**
 * @desc    Get unread count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ userId: req.user.id, isRead: false });
  res.status(200).json({ success: true, unreadCount: count });
});

/**
 * @desc    Mark one notification as read
 * @route   PUT /api/notifications/:notificationId/read
 * @access  Private
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.notificationId);
  if (!notification) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
  if (notification.userId.toString() !== req.user.id) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });

  notification.isRead = true;
  await notification.save();
  res.status(200).json({ success: true, data: notification });
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user.id, isRead: false },
    { $set: { isRead: true } }
  );
  res.status(200).json({ success: true, updatedCount: result.modifiedCount });
});

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:notificationId
 * @access  Private
 */
exports.deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.notificationId);
  if (!notification) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
  if (notification.userId.toString() !== req.user.id) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });

  await notification.deleteOne();
  res.status(200).json({ success: true, message: 'Notification deleted' });
});
