const logger = require('../utils/logger');

let twilioClient = null;

const getTwilio = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return null;
  }
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
};

/**
 * Send an SMS via Twilio
 * @param {string} toPhone - E.164 format e.g. +919876543210
 * @param {string} message
 */
exports.sendSMS = async (toPhone, message) => {
  const client = getTwilio();

  if (!client) {
    logger.warn('[SMS] Twilio not configured — SMS skipped');
    return { success: false, reason: 'Twilio not configured' };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: toPhone
    });

    logger.info(`[SMS] Sent to ${toPhone}: SID ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (err) {
    logger.error(`[SMS] Failed to send to ${toPhone}:`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send OTP SMS
 */
exports.sendOTP = async (toPhone, otp) => {
  const message = `Your Tap2Help verification OTP is: ${otp}. Valid for 10 minutes. Do not share this with anyone.`;
  return exports.sendSMS(toPhone, message);
};

/**
 * Notify helper via SMS when a new request is matched
 */
exports.notifyHelperSMS = async (toPhone, requestTitle, requesterName) => {
  const message = `Tap2Help: New help request nearby! "${requestTitle}" from ${requesterName}. Open the app to accept.`;
  return exports.sendSMS(toPhone, message);
};

/**
 * Notify requester via SMS when task is confirmed complete
 */
exports.notifyTaskCompleteSMS = async (toPhone, taskId) => {
  const message = `Tap2Help: Your task (${taskId}) has been marked complete. Please confirm in the app to release payment.`;
  return exports.sendSMS(toPhone, message);
};
