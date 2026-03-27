const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Connection event listeners
    mongoose.connection.on('disconnected', () => logger.warn('[DB] MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => logger.info('[DB] MongoDB reconnected'));
    mongoose.connection.on('error', (err) => logger.error('[DB] MongoDB error:', err));

  } catch (error) {
    logger.error(`[DB] Connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
