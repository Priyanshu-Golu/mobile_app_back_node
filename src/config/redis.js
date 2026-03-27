const { createClient } = require('redis');
const logger = require('../utils/logger');

let client = null;

const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    logger.warn('[Redis] REDIS_URL not set — Redis cache disabled');
    return null;
  }

  try {
    client = createClient({ url: process.env.REDIS_URL });

    client.on('error', (err) => logger.error('[Redis] Client error:', err.message));
    client.on('connect', () => logger.info('[Redis] Connected'));
    client.on('reconnecting', () => logger.warn('[Redis] Reconnecting...'));

    await client.connect();
    return client;
  } catch (err) {
    logger.error('[Redis] Failed to connect:', err.message);
    return null;
  }
};

const getRedis = () => client;

/**
 * Safe get — returns null if Redis unavailable
 */
const cacheGet = async (key) => {
  try {
    if (!client) return null;
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    logger.error('[Redis] GET error:', err.message);
    return null;
  }
};

/**
 * Safe set with TTL (seconds)
 */
const cacheSet = async (key, value, ttlSeconds = 300) => {
  try {
    if (!client) return false;
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (err) {
    logger.error('[Redis] SET error:', err.message);
    return false;
  }
};

/**
 * Safe delete
 */
const cacheDel = async (key) => {
  try {
    if (!client) return false;
    await client.del(key);
    return true;
  } catch (err) {
    logger.error('[Redis] DEL error:', err.message);
    return false;
  }
};

module.exports = { connectRedis, getRedis, cacheGet, cacheSet, cacheDel };
