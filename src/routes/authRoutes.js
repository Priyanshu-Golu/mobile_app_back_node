const express = require('express');
const {
  register, login, getMe, refreshToken,
  updatePassword, registerFCMToken,
  forgotPassword, resetPassword, verifyLoginOtp,
  sendEmailOtp, verifyEmailOtp, resendOtp
} = require('../controllers/authController');
const { validateRegister, validateLogin, validateUpdatePassword, validateFCMToken } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.post('/verify-login-otp', authLimiter, verifyLoginOtp);
router.get('/me', protect, getMe);
router.post('/refresh-token', refreshToken);
router.put('/update-password', protect, validateUpdatePassword, updatePassword);
router.post('/fcm-token', protect, validateFCMToken, registerFCMToken);
router.post('/forgot-password', authLimiter, forgotPassword);
router.put('/reset-password/:resettoken', resetPassword);
router.post('/resend-otp', authLimiter, resendOtp);
router.post('/send-email-otp', protect, sendEmailOtp);
router.post('/verify-email-otp', protect, verifyEmailOtp);

module.exports = router;
