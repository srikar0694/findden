#!/usr/bin/env node
/**
 * Tiny migration runner.
 *
 * Usage:
 *   node db/migrate.js up      # apply every unapplied .sql in db/migrations/
 *   node db/migrate.js status  # show applied vs pending
 *   node db/migrate.js seed    # apply every .sql in db/seeds/
 *   node db/migrate.js down    # NOT IMPLEMENTED — see note below
 *
 * Why not use node-pg-migrate / knex / etc?
 *   This codebase only needs forward-only migrations. A 70-line runner that
 *   we fully understand beats a dependency we have to learn.
 *
 * Rollbacks:
 *   We do not auto-generate `down` migrations. If you need to revert a
 *   schema change, write a new numbered migration that performs the reversal.
 *   That keeps history linear and auditable.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SEEDS_DIR      = path.join(__dirname, 'seeds');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureRegistry(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT        PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();  // numeric prefixes guarantee order
}

async function appliedSet(client) {
  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function up() {
  const client = await pool.connect();
  try {
    await ensureRegistry(client);
    const applied = await appliedSet(client);
    const files = listSqlFiles(MIGRATIONS_DIR);
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('✓ database is up to date');
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`→ applying ${file}`);
      // Each migration runs in its own transaction so a failure leaves
      // the registry in a consistent state.
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations(filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`✗ ${file} failed: ${err.message}`);
        throw err;
      }
    }
    console.log(`✓ applied ${pending.length} migration(s)`);
  } finally {
    client.release();
  }
}

async function status() {
  const client = await pool.connect();
  try {
    await ensureRegistry(client);
    const applied = await appliedSet(client);
    const files = listSqlFiles(MIGRATIONS_DIR);
    console.log('migration                              status');
    console.log('-------------------------------------- -------');
    for (const f of files) {
      console.log(`${f.padEnd(38)} ${applied.has(f) ? 'applied' : 'pending'}`);
    }
  } finally {
    client.release();
  }
}

async function seed() {
  const client = await pool.connect();
  try {
    const files = listSqlFiles(SEEDS_DIR);
    if (files.length === 0) {
      console.log('no seed files found');
      return;
    }
    for (const file of files) {
      const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');
      console.log(`→ seeding ${file}`);
      await client.query(sql);
    }
    console.log(`✓ seeded ${files.length} file(s)`);
  } finally {
    client.release();
  }
}

(async () => {
  const cmd = process.argv[2] || 'up';
  try {
    if (cmd === 'up')          await up();
    else if (cmd === 'status') await status();
    else if (cmd === 'seed')   await seed();
    else if (cmd === 'down') {
      console.error('rollback not supported — write a new forward migration');
      process.exit(2);
    } else {
      console.error(`unknown command: ${cmd}`);
      process.exit(2);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
