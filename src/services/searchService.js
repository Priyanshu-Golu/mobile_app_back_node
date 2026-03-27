const HelpRequest = require('../models/HelpRequest');
const User = require('../models/User');
const Professional = require('../models/Professional');
const { cacheGet, cacheSet } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Full-text search across requests and professionals.
 * Uses MongoDB text indexes (Elasticsearch-ready via adapter pattern).
 */

/**
 * Search help requests
 * @param {string} query - Search text
 * @param {object} filters - { category, urgency, status, lat, lng, radiusKm }
 * @param {number} page
 * @param {number} limit
 */
exports.searchRequests = async (query, filters = {}, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const matchStage = { status: { $in: ['Open', 'Assigned'] } };

  if (query) {
    matchStage.$text = { $search: query };
  }
  if (filters.category) matchStage.category = filters.category;
  if (filters.urgency) matchStage.urgency = filters.urgency;
  if (filters.pathType) matchStage.pathType = filters.pathType;

  let pipeline = [];

  // Geo filter if lat/lng provided
  if (filters.lat && filters.lng) {
    pipeline.push({
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [parseFloat(filters.lng), parseFloat(filters.lat)]
        },
        distanceField: 'distance',
        maxDistance: (filters.radiusKm || 10) * 1000,
        spherical: true,
        query: matchStage
      }
    });
  } else {
    pipeline.push({ $match: matchStage });
    if (query) {
      pipeline.push({ $sort: { score: { $meta: 'textScore' }, createdAt: -1 } });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
    }
  }

  pipeline.push(
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'requester',
        pipeline: [{ $project: { name: 1, averageRating: 1, profileImage: 1 } }]
      }
    },
    { $unwind: { path: '$requester', preserveNullAndEmptyArrays: true } }
  );

  const results = await HelpRequest.aggregate(pipeline);
  const total = await HelpRequest.countDocuments(matchStage);

  return { results, total, page, limit, pages: Math.ceil(total / limit) };
};

/**
 * Search professionals/helpers
 * @param {string} query - Search text (name, bio, skills)
 * @param {object} filters - { skill, lat, lng, radiusKm, minRating }
 */
exports.searchProfessionals = async (query, filters = {}, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const cacheKey = `search:pros:${query}:${JSON.stringify(filters)}:${page}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    logger.info('[Search] Returning cached professional results');
    return cached;
  }

  const matchStage = {
    role: { $in: ['helper', 'professional'] },
    isActive: true
  };

  if (query) matchStage.$text = { $search: query };
  if (filters.minRating) matchStage.averageRating = { $gte: parseFloat(filters.minRating) };
  if (filters.skill) matchStage.skills = { $in: [filters.skill] };

  let pipeline = [];

  if (filters.lat && filters.lng) {
    pipeline.push({
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [parseFloat(filters.lng), parseFloat(filters.lat)]
        },
        distanceField: 'distance',
        maxDistance: (filters.radiusKm || 10) * 1000,
        spherical: true,
        query: matchStage
      }
    });
  } else {
    pipeline.push({ $match: matchStage });
    pipeline.push({ $sort: { averageRating: -1 } });
  }

  pipeline.push(
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        name: 1, bio: 1, skills: 1, averageRating: 1, totalReviews: 1,
        profileImage: 1, isAvailable: 1, isVerified: 1,
        distance: 1
      }
    }
  );

  const results = await User.aggregate(pipeline);
  const total = await User.countDocuments(matchStage);

  const response = { results, total, page, limit, pages: Math.ceil(total / limit) };
  await cacheSet(cacheKey, response, 60); // Cache for 60 seconds
  return response;
};

/**
 * Ensure text indexes exist on the collections
 * Called once on app startup
 */
exports.ensureTextIndexes = async () => {
  try {
    await HelpRequest.collection.createIndex(
      { title: 'text', description: 'text', tags: 'text', category: 'text' },
      { weights: { title: 3, tags: 2, description: 1 }, name: 'help_request_text_index' }
    );
    await User.collection.createIndex(
      { name: 'text', bio: 'text', skills: 'text' },
      { weights: { name: 3, skills: 2, bio: 1 }, name: 'user_text_index' }
    );
    logger.info('[Search] Text indexes ensured');
  } catch (err) {
    // Index may already exist — ignore duplicate key error
    if (err.code !== 85 && err.code !== 86) {
      logger.error('[Search] Index creation error:', err.message);
    }
  }
};
