/**
 * One-shot migration script.
 * Adds the new fields required by the April 2026 change request to every
 * row in properties.json:
 *   - verified        (default false)
 *   - verified_at     (default null)
 *   - verified_by     (default null)
 *   - is_quick_post   (default false)
 *   - bhk             (default null)
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   node scripts/migrate-add-verified-quickpost.js
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'db', 'data', 'properties.json');

function run() {
  const raw = fs.readFileSync(FILE, 'utf8');
  const rows = JSON.parse(raw);
  let touched = 0;

  const migrated = rows.map((p) => {
    const next = { ...p };
    let changed = false;
    if (next.verified === undefined) { next.verified = false; changed = true; }
    if (next.verified_at === undefined) { next.verified_at = null; changed = true; }
    if (next.verified_by === undefined) { next.verified_by = null; changed = true; }
    if (next.is_quick_post === undefined) { next.is_quick_post = false; changed = true; }
    if (next.bhk === undefined) { next.bhk = null; changed = true; }
    if (changed) touched += 1;
    return next;
  });

  fs.writeFileSync(FILE, JSON.stringify(migrated, null, 2), 'utf8');
  console.log(`Migration complete — ${touched}/${rows.length} rows updated.`);
}

run();
