const asyncHandler = require('../middleware/asyncHandler');
const searchService = require('../services/searchService');

/**
 * @route   GET /api/search
 * @desc    Unified search endpoint — requests and professionals
 * @access  Public
 *
 * Query params:
 *   q         - search text
 *   type      - 'request' | 'professional' | 'all' (default: 'all')
 *   category  - filter by category (requests)
 *   urgency   - filter by urgency (requests)
 *   skill     - filter by skill (professionals)
 *   lat, lng  - center point for geo search
 *   radius    - search radius in km (default: 10)
 *   minRating - minimum average rating (professionals)
 *   pathType  - 'community' | 'professional' (requests)
 *   page      - page number (default: 1)
 *   limit     - results per page (default: 20)
 */
exports.search = asyncHandler(async (req, res) => {
  const {
    q = '',
    type = 'all',
    category,
    urgency,
    skill,
    lat,
    lng,
    radius,
    minRating,
    pathType,
    page = 1,
    limit = 20
  } = req.query;

  const filters = { category, urgency, skill, lat, lng, radiusKm: radius, minRating, pathType };
  const results = {};

  const searches = [];

  if (type === 'all' || type === 'request') {
    searches.push(
      searchService.searchRequests(q, filters, parseInt(page), parseInt(limit))
        .then(data => { results.requests = data; })
    );
  }

  if (type === 'all' || type === 'professional') {
    searches.push(
      searchService.searchProfessionals(q, filters, parseInt(page), parseInt(limit))
        .then(data => { results.professionals = data; })
    );
  }

  await Promise.all(searches);

  res.status(200).json({
    success: true,
    query: q,
    type,
    data: results
  });
});

/**
 * @route   GET /api/search/requests
 * @desc    Search help requests only
 * @access  Public
 */
exports.searchRequests = asyncHandler(async (req, res) => {
  const { q = '', category, urgency, pathType, lat, lng, radius, page = 1, limit = 20 } = req.query;
  const filters = { category, urgency, pathType, lat, lng, radiusKm: radius };

  const data = await searchService.searchRequests(q, filters, parseInt(page), parseInt(limit));
  res.status(200).json({ success: true, data });
});

/**
 * @route   GET /api/search/professionals
 * @desc    Search professionals / helpers
 * @access  Public
 */
exports.searchProfessionals = asyncHandler(async (req, res) => {
  const { q = '', skill, lat, lng, radius, minRating, page = 1, limit = 20 } = req.query;
  const filters = { skill, lat, lng, radiusKm: radius, minRating };

  const data = await searchService.searchProfessionals(q, filters, parseInt(page), parseInt(limit));
  res.status(200).json({ success: true, data });
});
