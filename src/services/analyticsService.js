const logger = require('../utils/logger');

let mixpanel = null;

const getMixpanel = () => {
  if (!process.env.MIXPANEL_TOKEN) return null;
  if (!mixpanel) {
    const Mixpanel = require('mixpanel');
    mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN);
  }
  return mixpanel;
};

/**
 * Track an event to Mixpanel (no-op if not configured)
 * @param {string} event - Event name
 * @param {object} properties - Event properties
 * @param {string} [userId] - User ID (for user-level tracking)
 */
exports.track = (event, properties = {}, userId = null) => {
  try {
    const mp = getMixpanel();
    if (!mp) return;

    const payload = {
      ...properties,
      time: new Date(),
      platform: 'backend'
    };

    if (userId) {
      payload.distinct_id = userId.toString();
    }

    mp.track(event, payload);
    logger.info(`[Analytics] Event tracked: ${event}`);
  } catch (err) {
    logger.error('[Analytics] Track error:', err.message);
  }
};

// ─── Convenience event helpers ───────────────────────────────────────────────

exports.trackRequestCreated = (userId, requestId, category, pathType) => {
  exports.track('request_created', { requestId, category, pathType }, userId);
};

exports.trackHelperMatched = (requestId, matchedCount) => {
  exports.track('helper_matched', { requestId, matchedCount });
};

exports.trackTaskAccepted = (taskId, helperId, requestId) => {
  exports.track('task_accepted', { taskId, requestId }, helperId);
};

exports.trackTaskCompleted = (taskId, requesterId, helperId, paymentMethod, amount) => {
  exports.track('task_completed', { taskId, paymentMethod, amount }, requesterId);
  exports.track('task_completed_helper', { taskId, paymentMethod, amount }, helperId);
};

exports.trackPaymentProcessed = (taskId, userId, paymentMethod, amountINR) => {
  exports.track('payment_processed', { taskId, paymentMethod, amountINR }, userId);
};

exports.trackUserRegistered = (userId, role) => {
  exports.track('user_registered', { role }, userId);
};

exports.trackReviewSubmitted = (reviewId, fromUserId, toUserId, rating) => {
  exports.track('review_submitted', { reviewId, toUserId, rating }, fromUserId);
};
