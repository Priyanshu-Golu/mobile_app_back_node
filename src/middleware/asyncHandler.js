/**
 * Async handler wrapper to eliminate try/catch boilerplate in controllers.
 * Usage: exports.myFn = asyncHandler(async (req, res, next) => { ... });
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
