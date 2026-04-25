const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { cors: corsConfig } = require('./config/env');
const { limiter } = require('./middlewares/rateLimiter');
const { errorHandler } = require('./middlewares/errorHandler');
const routes = require('./routes');
const logger = require('./utils/logger');

const app = express();

// Security headers — relax cross-origin so the React dev server can load
// uploaded images served from this same backend.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || corsConfig.allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Body parser — generous limit so base64-encoded image uploads fit.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static — uploaded property images
app.use('/uploads', express.static(path.join(__dirname, '..', 'db', 'uploads')));

// HTTP logging
app.use(morgan('dev', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// Global rate limiter
app.use('/api', limiter);

// API Routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
