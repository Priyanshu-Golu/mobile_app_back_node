const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Identity Verification Service
 * Integrates with IDfy/Aadhaar for background checks.
 * Falls back to a mock flow if API keys are not configured.
 */

const IDFY_BASE_URL = 'https://api.idfy.com/v1';

/**
 * Initiate Aadhaar OTP verification
 * @param {string} aadhaarNumber - 12-digit Aadhaar number
 * @param {string} userId - Internal user ID for tracking
 * @returns {{ success, transactionId }}
 */
exports.initiateAadhaarVerification = async (aadhaarNumber, userId) => {
  if (!process.env.IDFY_API_KEY) {
    logger.warn('[Verify] IDfy not configured — using mock flow');
    // Mock: generate a fake transaction ID
    const transactionId = `MOCK-TXID-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    logger.info(`[Verify] Mock OTP initiated for user ${userId}: txId=${transactionId}`);
    return { success: true, transactionId, mock: true };
  }

  try {
    const response = await fetch(`${IDFY_BASE_URL}/aadhaar/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.IDFY_API_KEY,
        'account-id': process.env.IDFY_ACCOUNT_ID || ''
      },
      body: JSON.stringify({
        id: userId.toString(),
        aadhaar_number: aadhaarNumber
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'IDfy API error');
    }

    logger.info(`[Verify] Aadhaar OTP sent for user ${userId}`);
    return { success: true, transactionId: data.transaction_id };
  } catch (err) {
    logger.error('[Verify] Aadhaar initiation failed:', err.message);
    throw err;
  }
};

/**
 * Verify Aadhaar OTP
 * @param {string} transactionId
 * @param {string} otp
 * @param {boolean} isMock
 * @returns {{ success, name, dob, gender, address }}
 */
exports.verifyAadhaarOTP = async (transactionId, otp, isMock = false) => {
  if (isMock || !process.env.IDFY_API_KEY) {
    // Mock verification: OTP must be "123456"
    if (otp === '123456') {
      return {
        success: true,
        name: 'Verified User',
        dob: '1990-01-01',
        gender: 'M',
        address: 'India',
        mock: true
      };
    }
    return { success: false, error: 'Invalid OTP (use 123456 in mock mode)' };
  }

  try {
    const response = await fetch(`${IDFY_BASE_URL}/aadhaar/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.IDFY_API_KEY,
        'account-id': process.env.IDFY_ACCOUNT_ID || ''
      },
      body: JSON.stringify({ transaction_id: transactionId, otp })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'OTP verification failed' };
    }

    return {
      success: true,
      name: data.name,
      dob: data.dob,
      gender: data.gender,
      address: data.address
    };
  } catch (err) {
    logger.error('[Verify] OTP verification error:', err.message);
    throw err;
  }
};

/**
 * Simple phone OTP verification (internal, using Redis for OTP storage)
 */
exports.generatePhoneOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
