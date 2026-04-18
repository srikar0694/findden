/**
 * JSON-based data store.
 * Mimics the PostgreSQL table structure exactly.
 * Each table is a JSON file under db/data/.
 * All reads are from in-memory cache; writes flush to disk.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../db/data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const cache = {};

/**
 * Load a table from disk into memory (lazy, once per process).
 */
function load(table) {
  if (cache[table]) return cache[table];
  const filePath = path.join(DATA_DIR, `${table}.json`);
  if (!fs.existsSync(filePath)) {
    cache[table] = [];
    return cache[table];
  }
  try {
    cache[table] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    cache[table] = [];
  }
  return cache[table];
}

/**
 * Flush a table back to disk after mutation.
 */
function flush(table) {
  const filePath = path.join(DATA_DIR, `${table}.json`);
  fs.writeFileSync(filePath, JSON.stringify(cache[table], null, 2), 'utf8');
}

/**
 * Generic CRUD operations mirroring SQL patterns.
 */
const db = {
  /** Return all rows from a table. */
  findAll(table) {
    return [...load(table)];
  },

  /** Find rows matching a predicate. */
  findWhere(table, predicate) {
    return load(table).filter(predicate);
  },

  /** Find first row matching a predicate. */
  findOne(table, predicate) {
    return load(table).find(predicate) || null;
  },

  /** Find by id. */
  findById(table, id) {
    return load(table).find((row) => row.id === id) || null;
  },

  /** Insert a new row. Returns the inserted row. */
  insert(table, row) {
    load(table).push(row);
    flush(table);
    return row;
  },

  /** Update rows matching predicate with partial data. Returns updated rows. */
  update(table, predicate, partial) {
    const rows = load(table);
    const updated = [];
    rows.forEach((row, i) => {
      if (predicate(row)) {
        rows[i] = { ...row, ...partial, updated_at: new Date().toISOString() };
        updated.push(rows[i]);
      }
    });
    if (updated.length) flush(table);
    return updated;
  },

  /** Update a single row by id. Returns the updated row or null. */
  updateById(table, id, partial) {
    const rows = load(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...partial, updated_at: new Date().toISOString() };
    flush(table);
    return rows[idx];
  },

  /** Delete rows matching predicate. Returns count deleted. */
  deleteWhere(table, predicate) {
    const rows = load(table);
    const before = rows.length;
    cache[table] = rows.filter((r) => !predicate(r));
    flush(table);
    return before - cache[table].length;
  },

  /** Delete by id. Returns boolean. */
  deleteById(table, id) {
    return db.deleteWhere(table, (r) => r.id === id) > 0;
  },

  /** Count rows matching predicate. */
  count(table, predicate) {
    return predicate ? load(table).filter(predicate).length : load(table).length;
  },

  /** Reload a table from disk (useful in tests). */
  reload(table) {
    delete cache[table];
    return load(table);
  },
};

module.exports = db;
