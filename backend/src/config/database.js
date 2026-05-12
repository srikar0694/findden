/**
 * PostgreSQL connection pool.
 *
 * One pool per Node process. All callers should issue queries through
 * `query()` (auto-checkout/release) or, for multi-statement work that needs
 * a transaction, through `withTransaction()`.
 *
 * The PostGIS extension is required — load it via the `001_extensions.sql`
 * migration before the app boots.
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '5000', 10),
});

pool.on('error', (err) => {
  // Idle clients can be terminated by the server (e.g. PG restart).
  // Logging the error keeps the process alive — the next checkout reconnects.
  logger.error('pg pool idle client error', { message: err.message });
});

/**
 * Run a single parameterized query.
 * @param {string} text  SQL with $1, $2 placeholders
 * @param {any[]}  params
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      logger.warn('slow query', { duration, text: text.slice(0, 120) });
    }
    return result;
  } catch (err) {
    logger.error('query failed', { message: err.message, text: text.slice(0, 120) });
    throw err;
  }
}

/**
 * Run multiple statements inside a single transaction.
 * The callback receives a checked-out client; commit/rollback is automatic.
 *
 *   await withTransaction(async (client) => {
 *     await client.query('UPDATE ...');
 *     await client.query('INSERT ...');
 *   });
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Health check used by GET /api/health. */
async function ping() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0].ok === 1;
}

/** Graceful shutdown — call on SIGTERM. */
async function close() {
  await pool.end();
}

module.exports = { pool, query, withTransaction, ping, close };
