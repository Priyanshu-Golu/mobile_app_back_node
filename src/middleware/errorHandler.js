const logger = require('../utils/logger');

/**
 * Centralized error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error(err); // Log error stack for debugging

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  const errorResponse = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      ...(err.details && { details: err.details })
    }
  };

  // Handle Mongoose Validator Error
  if (err.name === 'ValidationError') {
    res.status(400);
    errorResponse.error.code = 'VALIDATION_ERROR';
    errorResponse.error.message = 'Invalid input data';
    errorResponse.error.details = Object.values(err.errors).map(val => val.message);
  }

  // Handle Mongoose duplicate key
  if (err.code === 11000) {
    res.status(409);
    errorResponse.error.code = 'DUPLICATE_RESOURCE';
    errorResponse.error.message = 'Resource already exists';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401);
    errorResponse.error.code = 'INVALID_TOKEN';
    errorResponse.error.message = 'Token is invalid';
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401);
    errorResponse.error.code = 'TOKEN_EXPIRED';
    errorResponse.error.message = 'Token has expired';
  }

  res.status(res.statusCode || statusCode).json(errorResponse);
};

module.exports = errorHandler;
