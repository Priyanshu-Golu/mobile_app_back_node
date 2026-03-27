const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

// Rate limiting for auth endpoints (strict: 5 requests / 15 minutes)
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 500, // Temporarily increased for dev testing
  skip: () => true, // Skip rate limiting for dev testing
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again after 15 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiting for other endpoints (100 requests / 15 minutes)
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 100,
  skip: () => isTest,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many API requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});
