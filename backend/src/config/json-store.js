/**
 * Legacy JSON-file data store — kept for the cutover window only.
 *
 * The application has moved to PostgreSQL via `./database.js`. This file
 * remains so that any unmigrated callers (or rollback scenarios) can still
 * read the historical JSON snapshots under `db/data/`.
 *
 * DO NOT add new callers. Delete this file after the Postgres cutover is
 * verified in production for one full release.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../db/data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const cache = {};

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

function flush(table) {
  const filePath = path.join(DATA_DIR, `${table}.json`);
  fs.writeFileSync(filePath, JSON.stringify(cache[table], null, 2), 'utf8');
}

const jsonStore = {
  findAll: (table) => [...load(table)],
  findWhere: (table, predicate) => load(table).filter(predicate),
  findOne: (table, predicate) => load(table).find(predicate) || null,
  findById: (table, id) => load(table).find((row) => row.id === id) || null,
  insert: (table, row) => { load(table).push(row); flush(table); return row; },
  update: (table, predicate, partial) => {
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
  updateById: (table, id, partial) => {
    const rows = load(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...partial, updated_at: new Date().toISOString() };
    flush(table);
    return rows[idx];
  },
  deleteWhere: (table, predicate) => {
    const rows = load(table);
    const before = rows.length;
    cache[table] = rows.filter((r) => !predicate(r));
    flush(table);
    return before - cache[table].length;
  },
  deleteById: (table, id) => jsonStore.deleteWhere(table, (r) => r.id === id) > 0,
  count: (table, predicate) => (predicate ? load(table).filter(predicate).length : load(table).length),
  reload: (table) => { delete cache[table]; return load(table); },
};

module.exports = jsonStore;
