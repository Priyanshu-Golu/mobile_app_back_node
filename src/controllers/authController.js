const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const asyncHandler = require('../middleware/asyncHandler');
const sendEmail = require('../services/emailService');

// Generate access token
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '24h' });

// Generate refresh token
const generateRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, coordinates, bio } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(409).json({
      success: false,
      error: { code: 'USER_EXISTS', message: 'An account with this email already exists' }
    });
  }

  const userData = {
    name,
    email,
    password,
    phone,
    role: role || 'user',
    bio,
    credits: 50 // Signup bonus
  };

  if (coordinates && coordinates.length === 2) {
    userData.location = { type: 'Point', coordinates };
  }

  const user = await User.create(userData);

  // Generate a registration OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.loginOtp = otp;
  user.loginOtpExpire = Date.now() + 10 * 60 * 1000;
  await user.save();

  // Send Welcome Email WITH the OTP Verification code
  try {
    await sendEmail({
      email: user.email,
      subject: 'Welcome to Tap2Help — Verify Your Account! 🤝',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Welcome to Tap2Help, ${user.name}!</h2>
          <p>We are thrilled to have you join our neighborhood! To complete your registration and verify your email address, please enter the code below:</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
            <p style="margin-top: 0; color: #475569; font-weight: bold; font-size: 14px; text-transform: uppercase;">Your Verification Code</p>
            <h1 style="letter-spacing: 8px; color: #4F46E5; font-size: 36px; margin: 10px 0;">${otp}</h1>
            <p style="margin-bottom: 0; color: #64748b; font-size: 13px;">Valid for 10 minutes. Do not share this code.</p>
          </div>
          <p>Best regards,<br><b>Tap2Help Team</b></p>
        </div>
      `
    });
  } catch(err) {
    console.error('[Welcome Email Error]', err.message);
  }

  return res.status(201).json({
    success: true,
    requiresOtp: true,
    email: user.email,
    message: 'Registration successful. OTP sent for verification.'
  });
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +isActive');

  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
    });
  }

  if (user.isActive === false) {
    return res.status(401).json({
      success: false,
      error: { code: 'ACCOUNT_DEACTIVATED', message: 'This account has been deactivated' }
    });
  }

  // OTP logic for verified users
  if (user.isVerified) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.loginOtp = otp;
    user.loginOtpExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    try {
      await sendEmail({
        email: user.email,
        subject: 'Tap2Help — Login Verification',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Login Verification</h2>
            <p>Hello ${user.name},</p>
            <p>As a verified customer, you have an extra layer of security. Please use the following code to complete your login:</p>
            <h1 style="letter-spacing: 5px; color: #4F46E5;">${otp}</h1>
            <p>This code is valid for 10 minutes.</p>
            <br>
            <p>Best regards,<br>Tap2Help Team</p>
          </div>
        `,
      });
      return res.status(200).json({
        success: true,
        requiresOtp: true,
        email: user.email,
        message: 'OTP sent to your email.'
      });
    } catch (err) {
      user.loginOtp = undefined;
      user.loginOtpExpire = undefined;
      await user.save();
      return res.status(500).json({
        success: false,
        error: { code: 'EMAIL_ERROR', message: 'Could not send OTP email' }
      });
    }
  }

  const accessToken = generateToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  res.status(200).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
      profileImage: user.profileImage,
      accessToken,
      refreshToken
    }
  });
});

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, error: { code: 'NO_TOKEN', message: 'Refresh token is required' } });
  }

  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, secret);
  } catch {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Refresh token is invalid or expired' } });
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
  }

  const newAccessToken = generateToken(user._id, user.role);
  res.status(200).json({ success: true, accessToken: newAccessToken });
});

/**
 * @desc    Update password
 * @route   PUT /api/auth/update-password
 * @access  Private
 */
exports.updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.matchPassword(currentPassword))) {
    return res.status(401).json({
      success: false,
      error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect' }
    });
  }

  user.password = newPassword;
  await user.save();

  const accessToken = generateToken(user._id, user.role);
  res.status(200).json({ success: true, message: 'Password updated successfully', accessToken });
});

/**
 * @desc    Register FCM token for push notifications
 * @route   POST /api/auth/fcm-token
 * @access  Private
 */
exports.registerFCMToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  await User.findByIdAndUpdate(req.user.id, { fcmToken });
  res.status(200).json({ success: true, message: 'FCM token registered successfully' });
});

/**
 * @desc    Forgot Password — send reset email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    // Don't reveal if email exists (security best practice)
    return res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  }

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Tap2Help — Password Reset',
      html: sendEmail.templates.passwordReset(resetUrl),
      message: `Reset your password: ${resetUrl}`
    });
    res.status(200).json({ success: true, message: 'Password reset email sent' });
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return res.status(500).json({ success: false, error: { code: 'EMAIL_FAILED', message: 'Email could not be sent' } });
  }
});

/**
 * @desc    Reset Password
 * @route   PUT /api/auth/reset-password/:resettoken
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Reset token is invalid or has expired' } });
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.status(200).json({ success: true, message: 'Password has been reset successfully' });
});

/**
 * @desc    Verify Login OTP
 * @route   POST /api/auth/verify-login-otp
 * @access  Public
 */
exports.verifyLoginOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'Please provide email and OTP' }
    });
  }

  const user = await User.findOne({ 
    email: email.toLowerCase(),
    loginOtp: otp,
    loginOtpExpire: { $gt: Date.now() }
  }).select('+isActive');

  if (!user) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP' }
    });
  }

  if (user.isActive === false) {
    return res.status(401).json({
      success: false,
      error: { code: 'ACCOUNT_DEACTIVATED', message: 'This account has been deactivated' }
    });
  }

  // Mark the user as dynamically verified if they weren't before!
  if (!user.isVerified) {
    user.isVerified = true;
    user.verifiedAt = Date.now();
  }

  user.loginOtp = undefined;
  user.loginOtpExpire = undefined;
  await user.save();

  const accessToken = generateToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  res.status(200).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
      profileImage: user.profileImage,
      accessToken,
      refreshToken
    }
  });
});
