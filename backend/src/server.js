require('./config/env'); // validate env vars first
const app = require('./app');
const { port } = require('./config/env');
const logger = require('./utils/logger');
const db = require('./config/database');

const server = app.listen(port, () => {
  logger.info(`🏠 FindDen API running on http://localhost:${port}`);
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   Health: http://localhost:${port}/api/health`);
});

// Graceful shutdown — drain HTTP, then close the pg pool.
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await db.close();
      logger.info('pg pool drained');
    } catch (err) {
      logger.error('error closing pg pool', { message: err.message });
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after 10s');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

module.exports = server;
