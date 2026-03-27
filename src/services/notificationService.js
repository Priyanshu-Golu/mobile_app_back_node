const admin = require('firebase-admin');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');

// Initialize Firebase Admin SDK once at startup (not on every call)
let firebaseInitialized = false;

const initFirebase = () => {
  if (firebaseInitialized) return;
  try {
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.NODE_ENV !== 'test'
    ) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
      firebaseInitialized = true;
      logger.info('[FCM] Firebase Admin SDK initialized');
    } else {
      logger.info('[FCM] Firebase env vars not set — push notifications will be DB-only');
    }
  } catch (err) {
    logger.error('[FCM] Firebase initialization failed:', err.message);
  }
};

// Attempt initialization on module load
initFirebase();

/**
 * Send a notification to a single user.
 * Always persists to DB; also sends FCM if token available.
 */
exports.sendNotification = async ({ userId, type, title, message, data = {} }) => {
  try {
    // 1. Save to database (always)
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      data
    });

    // 2. Fetch user FCM token
    const user = await User.findById(userId).select('+fcmToken');

    // 3. Send FCM push notification (non-blocking on failure)
    if (user?.fcmToken && firebaseInitialized) {
      const payload = {
        notification: { title, body: message },
        data: {
          type,
          notificationId: notification._id.toString(),
          ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
        },
        token: user.fcmToken
      };

      try {
        await admin.messaging().send(payload);
        logger.info(`[FCM] Push sent to user ${userId}`);
      } catch (fcmErr) {
        // If token is invalid/expired, clear it from DB
        if (fcmErr.code === 'messaging/invalid-registration-token' ||
            fcmErr.code === 'messaging/registration-token-not-registered') {
          await User.findByIdAndUpdate(userId, { $unset: { fcmToken: 1 } });
          logger.warn(`[FCM] Cleared invalid token for user ${userId}`);
        } else {
          logger.error(`[FCM] Failed to send push to user ${userId}: ${fcmErr.message}`);
        }
      }
    }

    return notification;
  } catch (error) {
    logger.error('[Notification] Error creating notification:', error);
    throw error;
  }
};

/**
 * Send notification to multiple users in bulk.
 */
exports.sendBulkNotification = async (userIds, { type, title, message, data = {} }) => {
  const results = await Promise.allSettled(
    userIds.map(userId =>
      exports.sendNotification({ userId, type, title, message, data })
    )
  );

  const fulfilled = results.filter(r => r.status === 'fulfilled').length;
  const rejected = results.filter(r => r.status === 'rejected').length;
  logger.info(`[Notification] Bulk sent: ${fulfilled} ok, ${rejected} failed`);
  return { fulfilled, rejected };
};
