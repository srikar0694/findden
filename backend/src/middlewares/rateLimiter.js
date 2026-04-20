/**
 * Rate limiting middleware.
 *
 * Controlled by the `rateLimit.enabled` feature flag in config/env.js
 * (env var: RATE_LIMIT_ENABLED).
 *
 *   RATE_LIMIT_ENABLED=true   → real express-rate-limit middleware
 *   anything else (default)   → no-op middleware (passes through)
 *
 * This lets us toggle the "Too many requests. Please try again later."
 * behaviour off during dev/QA without removing the wiring from app.js
 * or auth.routes.js.
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { rateLimit: rateLimitConfig } = require('../config/env');

// No-op middleware: just calls next(). Used when the feature is disabled.
const noop = (req, res, next) => next();

let limiter;
let authLimiter;

if (rateLimitConfig.enabled) {
  limiter = rateLimit({
    windowMs: rateLimitConfig.windowMs,
    max: rateLimitConfig.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    },
  });

  authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many auth attempts. Please try again in 15 minutes.',
      },
    },
  });

  if (logger && typeof logger.info === 'function') {
    logger.info('[RateLimit] enabled');
  }
} else {
  limiter = noop;
  authLimiter = noop;

  if (logger && typeof logger.info === 'function') {
    logger.info('[RateLimit] disabled (set RATE_LIMIT_ENABLED=true to enable)');
  }
}

module.exports = { limiter, authLimiter };
