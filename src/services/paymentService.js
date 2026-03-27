const crypto = require('crypto');
const logger = require('../utils/logger');

// Lazy-load Razorpay only if credentials exist
let Razorpay = null;
let razorpay = null;

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  if (!razorpay) {
    Razorpay = require('razorpay');
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpay;
};

/**
 * Create a Razorpay order for money payment
 * @param {number} amountINR - Amount in INR (not paise)
 * @param {string} receiptId - Unique reference (taskId)
 * @returns {object} Razorpay order object
 */
exports.createOrder = async (amountINR, receiptId) => {
  const rz = getRazorpay();
  if (!rz) throw new Error('Payment gateway not configured');

  const options = {
    amount: Math.round(amountINR * 100), // Convert to paise
    currency: 'INR',
    receipt: `receipt_${receiptId}`,
    payment_capture: 1
  };

  try {
    const order = await rz.orders.create(options);
    logger.info(`[Payment] Order created: ${order.id} for ₹${amountINR}`);
    return order;
  } catch (err) {
    logger.error('[Payment] Order creation failed:', err.message);
    throw err;
  }
};

/**
 * Verify Razorpay payment signature
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string} signature
 * @returns {boolean}
 */
exports.verifySignature = (orderId, paymentId, signature) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  const isValid = expectedSignature === signature;
  logger.info(`[Payment] Signature verification: ${isValid ? 'PASSED' : 'FAILED'} for order ${orderId}`);
  return isValid;
};

/**
 * Calculate credit-to-money conversion
 * 1 credit = ₹1 (configurable)
 */
exports.creditsToINR = (credits) => {
  const rate = parseFloat(process.env.CREDIT_TO_INR_RATE || '1');
  return credits * rate;
};

exports.inrToCredits = (amountINR) => {
  const rate = parseFloat(process.env.CREDIT_TO_INR_RATE || '1');
  return Math.floor(amountINR / rate);
};
