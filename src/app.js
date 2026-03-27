const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');
 const { connectRedis } = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');
const requestId = require('./middleware/requestId');

const { Server } = require('socket.io');
const { apiLimiter } = require('./middleware/rateLimiter');

const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const logger = require('./utils/logger');

// ─── Initialize App ──────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Initialize Socket.io ────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

require('./socket/chatHandler')(io);

// ─── Connect to Database ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(async () => {
    // Ensure text indexes after DB connect
    const { ensureTextIndexes } = require('./services/searchService');
    await ensureTextIndexes();
  });
  connectRedis();
}

// ─── Initialize CRON Jobs ────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  require('./utils/cronJobs')();
}

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // Allow serving uploaded images
}));
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
app.use(requestId);
app.use(apiLimiter);

// ─── Body Parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Serve Uploaded Files Statically ────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Tap2Help API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// ─── Swagger Docs ────────────────────────────────────────────────────────────
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: { persistAuthorization: true }
}));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/credits', require('./routes/creditRoutes'));
app.use('/api/messages', require('./routes/chatRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/professionals', require('./routes/professionalRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
// ─── New Phase 1 Routes ───────────────────────────────────────────────────────
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/verify', require('./routes/verificationRoutes'));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` }
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Export ──────────────────────────────────────────────────────────────────
module.exports = { app, server, io };

console.log("TAP2HELP SERVER RESTART TRIGGERED");
// Start server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => {
    logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  });
}
