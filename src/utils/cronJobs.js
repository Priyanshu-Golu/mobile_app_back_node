const cron = require('node-cron');
const HelpRequest = require('../models/HelpRequest');
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

const initCronJobs = () => {
  // ─── Auto-expire Open requests older than 24 hours (runs every hour) ─────
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Checking for expired help requests...');

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const expiredRequests = await HelpRequest.find({
        status: 'Open',
        createdAt: { $lt: twentyFourHoursAgo }
      });

      if (expiredRequests.length > 0) {
        logger.info(`[CRON] Expiring ${expiredRequests.length} requests...`);

        for (const req of expiredRequests) {
          req.status = 'Expired';
          await req.save();

          await notificationService.sendNotification({
            userId: req.userId,
            type: 'TASK_CANCELLED',
            title: 'Request Expired',
            message: `Your request "${req.title}" expired after 24 hours with no helpers accepting.`,
            data: { requestId: req._id.toString() }
          }).catch(() => {});
        }
      }
    } catch (error) {
      logger.error('[CRON] Auto-expire requests failed:', error);
    }
  });

  // ─── Remind helpers of assigned but unstarted tasks (runs every 30 min) ───
  cron.schedule('*/30 * * * *', async () => {
    try {
      const Task = require('../models/Task');
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const staleTasks = await Task.find({
        status: 'Assigned',
        acceptedAt: { $lt: oneHourAgo }
      }).populate('requestId', 'title');

      for (const task of staleTasks) {
        await notificationService.sendNotification({
          userId: task.helperId,
          type: 'REMINDER',
          title: '⏰ Reminder: You have an active task',
          message: `Don't forget your accepted task: "${task.requestId?.title}". The requester is waiting!`,
          data: { taskId: task._id.toString() }
        }).catch(() => {});
      }

      if (staleTasks.length > 0) {
        logger.info(`[CRON] Sent ${staleTasks.length} stale task reminders`);
      }
    } catch (error) {
      logger.error('[CRON] Stale task reminder failed:', error);
    }
  });

  logger.info('[CRON] ✅ All CRON jobs initialized');
};

module.exports = initCronJobs;
