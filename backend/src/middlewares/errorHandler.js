const logger = require('../utils/logger');
const { serverError } = require('../utils/response');

/**
 * Global error handler — must be registered last in Express.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
  });
  return serverError(res, process.env.NODE_ENV === 'development' ? err.message : 'Internal server error');
};

module.exports = { errorHandler };
