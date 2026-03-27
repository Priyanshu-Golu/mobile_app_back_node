/**
 * Admin-only route guard. Must be used AFTER the protect middleware.
 */
const adminAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required' }
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'ADMIN_ONLY', message: 'This route is restricted to administrators only' }
    });
  }

  next();
};

module.exports = adminAuth;
