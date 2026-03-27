const { v4: uuidv4 } = require('uuid');

/**
 * Attaches a unique X-Request-ID to every request for tracing.
 * If client sends one, it is reused; otherwise a new UUID is generated.
 */
const requestId = (req, res, next) => {
  const id = req.headers['x-request-id'] || uuidv4();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};

module.exports = requestId;
