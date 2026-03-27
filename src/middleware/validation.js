const { body, validationResult } = require('express-validator');

// Validation execution middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input parameters',
        details: errors.array().map(err => ({ field: err.path, message: err.msg }))
      }
    });
  }
  next();
};

// ─── Auth Validations ────────────────────────────────────────────────────────

exports.validateRegister = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Must be a valid email address'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least 1 uppercase letter, 1 number, and 1 special character'),
  body('phone').optional({ checkFalsy: true })
    .matches(/^(\+?\d{1,3})?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}$|^\d{10}$/)
    .withMessage('Phone must be a valid number (e.g. 9876543210 or +919876543210)'),
  body('role').optional().isIn(['user', 'helper', 'professional']).withMessage('Invalid role'),
  validate
];

exports.validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Please provide a password'),
  validate
];

exports.validateUpdatePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least 1 uppercase, 1 number, and 1 special character'),
  validate
];

exports.validateFCMToken = [
  body('fcmToken').notEmpty().withMessage('FCM token is required'),
  validate
];

// ─── Request Validations ─────────────────────────────────────────────────────

exports.validateHelpRequest = [
  body('title').isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
  body('description').isLength({ min: 5, max: 500 }).withMessage('Description must be between 5 and 500 characters'),
  body('category').isIn(['Moving Help', 'Repair', 'Emergency', 'Delivery', 'Tutoring', 'Groceries', 'Other']).withMessage('Invalid category'),
  body('urgency').isIn(['Low', 'Medium', 'High', 'Emergency']).withMessage('Invalid urgency level'),
  body('paymentType').optional().isIn(['credits', 'cash', 'free']).withMessage('Invalid payment type'),
  body('creditValue').optional().isInt({ min: 5, max: 100 }).withMessage('Credit value must be between 5 and 100'),
  body('coordinates')
    .isArray({ min: 2, max: 2 }).withMessage('Coordinates must be an array of [longitude, latitude]')
    .custom((value) => {
      const [lng, lat] = value;
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        throw new Error('Coordinates must be numbers');
      }
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error('Invalid coordinate ranges');
      }
      return true;
    }),
  validate
];

// ─── Review Validations ───────────────────────────────────────────────────────

exports.validateReview = [
  body('taskId').isMongoId().withMessage('Valid Task ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5'),
  body('comment').optional().isLength({ min: 10, max: 500 }).withMessage('Comment must be between 10 and 500 characters'),
  validate
];

// ─── Professional Validations ─────────────────────────────────────────────────

exports.validateProfessionalProfile = [
  body('serviceCategory').isIn(['Plumbing', 'Electrical', 'Tutoring', 'Mechanical', 'Carpentry', 'Cleaning', 'Painting', 'IT Support', 'Other']).withMessage('Invalid service category'),
  body('qualifications').optional().isLength({ max: 500 }).withMessage('Qualifications cannot exceed 500 characters'),
  body('serviceRadius').optional().isInt({ min: 1, max: 50 }).withMessage('Service radius must be between 1 and 50 km'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Hourly rate must be a positive number'),
  body('coordinates').optional().isArray({ min: 2, max: 2 }).withMessage('Coordinates must be [longitude, latitude]'),
  validate
];

// ─── Report Validations ───────────────────────────────────────────────────────

exports.validateReport = [
  body('reason').isIn(['Spam', 'Harassment', 'Fraud', 'Inappropriate Content', 'No-show', 'Other']).withMessage('Invalid report reason'),
  body('description').isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('reportedUserId').optional().isMongoId().withMessage('Invalid user ID'),
  body('reportedTaskId').optional().isMongoId().withMessage('Invalid task ID'),
  body('reportedRequestId').optional().isMongoId().withMessage('Invalid request ID'),
  validate
];
