# FindDen — JSON → PostgreSQL Migration Plan

**Goal:** Replace the JSON-file data store (`backend/db/data/*.json` + `backend/src/config/database.js`) with PostgreSQL 15 + PostGIS, using a data model that stays fast at 10M+ property rows.

**Scope:** Backend repo only. Zero frontend contract changes — the API response shapes defined in `SYSTEM_DESIGN.md` (sections 5.x) must remain identical after the cutover.

---

## 0. Guiding Principles (Read First)

Before writing any code, internalize the read-path constraints. These drive every schema decision below.

1. **Hot path = property search.** 95%+ of traffic hits `GET /api/properties` with a bounding box + filters + ordering. Every column on that query path must be indexed; nothing else matters as much.
2. **Write less, index right.** Don't index every column — each index slows inserts and bloats the heap. Only index columns that appear in `WHERE`, `ORDER BY`, or `JOIN` conditions for the top 5 queries.
3. **Avoid `SELECT *` on properties.** The list endpoint should return a thin projection (id, title, price, location, thumbnail). Detail page is a separate query.
4. **Geo queries use the geography column directly.** Never cast `location::geometry` inside an indexed predicate at scale — use the GiST index on `geography(Point,4326)` with `ST_DWithin` / `&&` operators.
5. **Pagination by keyset, not OFFSET.** OFFSET on millions of rows is O(n). Use `(created_at, id) < (:cursor_created_at, :cursor_id)` instead.
6. **Migrations are forward-only and idempotent.** Every SQL file uses `IF NOT EXISTS` / `IF EXISTS`. No destructive changes without an explicit reversal file.

---

## 1. Phase Overview

| Phase | What | Deliverable | Owner Time |
|---|---|---|---|
| 1 | Provision Postgres + PostGIS | running DB instance | 0.5 day |
| 2 | Add pg client, config, migration runner | `db/migrate.js`, updated `config/database.js` | 0.5 day |
| 3 | Author schema migrations | `db/migrations/001…010.sql` | 1 day |
| 4 | Author seed + JSON import script | `db/seeds/`, `scripts/import-json.js` | 0.5 day |
| 5 | Refactor models to SQL | `src/models/*.model.js` rewritten | 1.5 days |
| 6 | Add repository layer + query helpers | `src/repositories/`, `utils/sql.js` | 0.5 day |
| 7 | Verify parity (tests + smoke) | green test suite + perf snapshot | 1 day |
| 8 | Cut over + remove JSON store | PR merged, JSON files archived | 0.5 day |

Total: ~6 working days for one engineer.

---

## 2. Phase 1 — Provision PostgreSQL + PostGIS

**Local dev (Docker Compose).** Add `backend/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgis/postgis:15-3.4
    container_name: findden-pg
    environment:
      POSTGRES_DB: findden
      POSTGRES_USER: findden
      POSTGRES_PASSWORD: findden
    ports: ["5432:5432"]
    volumes:
      - findden_pg_data:/var/lib/postgresql/data
    command: >
      postgres
      -c shared_buffers=512MB
      -c work_mem=32MB
      -c maintenance_work_mem=256MB
      -c effective_cache_size=2GB
      -c random_page_cost=1.1
volumes:
  findden_pg_data:
```

**Why these tunables:** `random_page_cost=1.1` is correct for SSDs and makes the planner pick index scans over seq scans on the properties table. `work_mem=32MB` gives sort/hash operations enough room without blowing up under concurrency. Bump these on prod.

**Production:** managed Postgres (RDS / Cloud SQL / Neon) with PostGIS extension enabled. Minimum `db.r6g.large` (2 vCPU / 16 GB RAM) for 10M rows. Enable PITR backups.

**Add to `.env.example`:**

```
DATABASE_URL=postgres://findden:findden@localhost:5432/findden
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_STATEMENT_TIMEOUT_MS=5000
```

---

## 3. Phase 2 — pg Client + Migration Runner

Install dependencies in `backend/`:

```
npm i pg
npm i -D node-pg-migrate
```

Use `pg` (not an ORM). At 10M rows the planner hints, partial indexes, and PostGIS operators we need are easier to express in raw SQL than in Sequelize/Prisma.

**Replace `backend/src/config/database.js`** with a `pg.Pool`:

```js
// src/config/database.js
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30_000,
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '5000', 10),
});

pool.on('error', (err) => logger.error('pg pool error', { err }));

module.exports = {
  query: (text, params) => pool.query(text, params),
  // For transactions: caller must release.
  getClient: () => pool.connect(),
  pool,
};
```

**Why a pool, not a single client:** Express is multi-request concurrent. Each request grabs a client, runs its query, releases. `max=20` is a safe default behind a single Node process; raise once you put pgBouncer in front.

---

## 4. Phase 3 — Schema Migrations

Create `backend/db/migrations/` with numbered SQL files. Each file is one logical change and starts with a comment header. Run via a thin runner (`db/migrate.js`) that records applied filenames in a `schema_migrations` table.

### 4.1 `001_extensions.sql`
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- for fuzzy title/city search
CREATE EXTENSION IF NOT EXISTS btree_gist;    -- for combining b-tree + gist columns
```

### 4.2 `002_enums.sql`
The five enums from `SYSTEM_DESIGN.md §3.3` (user_role, property_type, property_status, subscription_status, transaction_status). Wrap each in `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL; END $$;` so reruns don't fail.

### 4.3 `003_users.sql`, `004_plans.sql`, `005_subscriptions.sql`, `007_transactions.sql`
Use the table definitions from `SYSTEM_DESIGN.md §4` as-is. They're already correct for the volumes involved (users < 10M, plans < 100, subscriptions < 50M, transactions < 200M).

### 4.4 `006_properties.sql` — The Critical One

This is the table we tune for. Extend the SYSTEM_DESIGN version with three production-grade additions:

```sql
CREATE TABLE properties (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(255)  NOT NULL,
  description       TEXT,
  property_type     property_type NOT NULL,
  status            property_status NOT NULL DEFAULT 'draft',
  listing_type      VARCHAR(10)   NOT NULL CHECK (listing_type IN ('sale','rent')),
  price             NUMERIC(14,2) NOT NULL,
  price_negotiable  BOOLEAN       NOT NULL DEFAULT FALSE,
  bedrooms          SMALLINT,
  bathrooms         SMALLINT,
  area_sqft         NUMERIC(10,2),
  furnishing        VARCHAR(20)   CHECK (furnishing IN ('unfurnished','semi','furnished')),
  floor             SMALLINT,
  total_floors      SMALLINT,
  address_line      TEXT          NOT NULL,
  city              VARCHAR(100)  NOT NULL,
  state             VARCHAR(100)  NOT NULL,
  pincode           VARCHAR(10)   NOT NULL,
  location          GEOGRAPHY(Point, 4326) NOT NULL,
  images            TEXT[]        NOT NULL DEFAULT '{}',
  amenities         TEXT[]        NOT NULL DEFAULT '{}',
  available_from    DATE,
  views_count       INT           NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- 1. Generated tsvector for full-text search on title + city + address.
  search_doc        tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title,'')),       'A') ||
    setweight(to_tsvector('simple', coalesce(city,'')),        'B') ||
    setweight(to_tsvector('simple', coalesce(address_line,'')),'C')
  ) STORED,

  -- 2. Pre-extracted lat/lng for cheap projection in list responses
  --    (avoids ST_X/ST_Y on every row for the list endpoint).
  latitude          DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED,
  longitude         DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(location::geometry)) STORED
);
```

**Indexes — and why each one exists:**

```sql
-- (a) The map query: bounding-box + status='active' is 95% of reads.
--     Partial index keeps it ~30% smaller and faster.
CREATE INDEX idx_properties_location_active
  ON properties USING GIST (location)
  WHERE status = 'active';

-- (b) Full-text search across title/city/address.
CREATE INDEX idx_properties_search_doc
  ON properties USING GIN (search_doc);

-- (c) Common filter combo. Order matters: high-cardinality first
--     (city) so the index narrows fast, then enums.
CREATE INDEX idx_properties_filter
  ON properties (city, listing_type, property_type, status);

-- (d) Price range filter on active listings only.
CREATE INDEX idx_properties_price_active
  ON properties (price)
  WHERE status = 'active';

-- (e) Owner dashboard ("my listings").
CREATE INDEX idx_properties_owner_created
  ON properties (owner_id, created_at DESC);

-- (f) Keyset pagination on the home feed (active, newest first).
CREATE INDEX idx_properties_active_recent
  ON properties (created_at DESC, id DESC)
  WHERE status = 'active';

-- (g) Trigram index for "city LIKE 'bang%'" autosuggest.
CREATE INDEX idx_properties_city_trgm
  ON properties USING GIN (city gin_trgm_ops);
```

**What we deliberately do NOT index:**
- `bedrooms`, `bathrooms`, `area_sqft`, `furnishing` — low cardinality; b-tree wouldn't help and the planner will just bitmap-AND with the partial index above. Verify with `EXPLAIN ANALYZE` before adding.
- `description` — never filtered on directly.
- `amenities`, `images` — only read for detail page; PG's TOAST keeps them off the hot path.

### 4.5 `008_partitioning.sql` — Plan for Scale

At 10M+ rows the `properties` table benefits from declarative partitioning by `city` (or `state` if cities are too granular). Don't partition on day 1 — ship the unpartitioned table first and add this migration once the heap exceeds ~50 GB or city queries start scanning > 100k rows.

When the time comes:
```sql
-- (Future) convert to LIST partitioning by state. Sketch only:
-- CREATE TABLE properties_new (LIKE properties INCLUDING ALL) PARTITION BY LIST (state);
-- CREATE TABLE properties_ka PARTITION OF properties_new FOR VALUES IN ('Karnataka');
-- ... migrate via INSERT ... SELECT in batches, swap names, drop old.
```

Document the cut-over criteria now, leave the migration file empty until triggered.

### 4.6 `009_audit_columns.sql`
Add an `updated_at` trigger so every UPDATE refreshes the timestamp without app-side bookkeeping. One trigger per mutable table (users, properties, subscriptions, transactions, plans).

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

CREATE TRIGGER trg_properties_updated_at
BEFORE UPDATE ON properties
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Repeat for users, subscriptions, transactions.
```

### 4.7 `010_seed_plans.sql`
Insert the three pricing plans (`Starter`, `Pro`, `Enterprise`) referenced by `subscriptions.json`. Uses fixed UUIDs so dev environments stay reproducible.

---

## 5. Phase 4 — JSON Import Script

The repo currently has `backend/db/data/subscriptions.json` and `transactions.json`. Once `users.json`, `plans.json`, `properties.json` are added (or treated as empty), one script imports all of them.

**Create `backend/scripts/import-json.js`:**

Behavior:
1. Connect to the configured DB.
2. Wrap the entire import in one transaction so partial failure leaves the DB clean.
3. Insert in dependency order: `plans → users → subscriptions → properties → transactions`.
4. For `properties`, build the `location` column with `ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography`.
5. Use `pg-copy-streams` for tables with > 10k rows (it's 10–50× faster than batched INSERT).
6. Print a summary: rows read, rows inserted, rows skipped (with reasons).

**Skeleton:**
```js
// scripts/import-json.js
const fs = require('fs');
const path = require('path');
const { from: copyFrom } = require('pg-copy-streams');
const { pool } = require('../src/config/database');

async function importTable(client, table, file, mapper) {
  if (!fs.existsSync(file)) return { table, inserted: 0, skipped: 'file missing' };
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const row of rows) {
    const { sql, params } = mapper(row);
    await client.query(sql, params);
  }
  return { table, inserted: rows.length };
}

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // ... call importTable for each json file with its row mapper
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
})();
```

**Add npm scripts:**
```json
"db:migrate":  "node db/migrate.js up",
"db:rollback": "node db/migrate.js down",
"db:seed":     "psql $DATABASE_URL -f db/seeds/plans.seed.sql",
"db:import":   "node scripts/import-json.js"
```

---

## 6. Phase 5 — Refactor Models

Each model file currently calls the JSON store (`db.findById`, `db.findWhere`, …). Rewrite each to issue parameterized SQL through `pool.query`. Keep the **exported function signatures identical** so services don't have to change.

**Pattern — `subscription.model.js` (after):**
```js
const db = require('../config/database');

const SubscriptionModel = {
  findById: async (id) => {
    const { rows } = await db.query(
      'SELECT * FROM subscriptions WHERE id = $1', [id]);
    return rows[0] || null;
  },

  findActiveByUserId: async (userId) => {
    const { rows } = await db.query(`
      SELECT * FROM subscriptions
      WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
      ORDER BY expires_at DESC LIMIT 1
    `, [userId]);
    return rows[0] || null;
  },

  /** Atomic quota deduction — fails (returns null) if quota exceeded. */
  deductQuota: async (subscriptionId) => {
    const { rows } = await db.query(`
      UPDATE subscriptions s
      SET quota_used = s.quota_used + 1, updated_at = NOW()
      FROM plans p
      WHERE s.id = $1 AND s.plan_id = p.id
        AND s.status = 'active' AND s.expires_at > NOW()
        AND s.quota_used < p.quota
      RETURNING s.id, s.quota_used
    `, [subscriptionId]);
    return rows[0] || null;
  },
};
```

**Why the SQL version is better than the JSON version of `deductQuota`:** the JSON one had a TOCTOU race (`findById` then `updateById`). The SQL UPDATE…WHERE…RETURNING is one atomic statement — Postgres takes the row lock for us.

Repeat the rewrite for `transaction.model.js` and create the new ones (`user.model.js`, `plan.model.js`, `property.model.js`) referenced by `SYSTEM_DESIGN.md §6.1`.

**`property.model.js` — the search query** (most important method in the codebase):

```js
async function search({
  swLat, swLng, neLat, neLng,
  city, listingType, propertyType, minPrice, maxPrice, bedrooms,
  cursor, limit = 20,
}) {
  const params = [];
  const where = [`p.status = 'active'`];

  if (swLat != null) {
    params.push(swLng, swLat, neLng, neLat);
    where.push(`p.location && ST_MakeEnvelope(
      $${params.length-3}, $${params.length-2},
      $${params.length-1}, $${params.length}, 4326)::geography`);
  }
  if (city)         { params.push(city);         where.push(`p.city = $${params.length}`); }
  if (listingType)  { params.push(listingType);  where.push(`p.listing_type = $${params.length}`); }
  if (propertyType) { params.push(propertyType); where.push(`p.property_type = $${params.length}`); }
  if (minPrice)     { params.push(minPrice);     where.push(`p.price >= $${params.length}`); }
  if (maxPrice)     { params.push(maxPrice);     where.push(`p.price <= $${params.length}`); }
  if (bedrooms)     { params.push(bedrooms);     where.push(`p.bedrooms >= $${params.length}`); }

  // Keyset pagination — far cheaper than OFFSET on large tables.
  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    where.push(`(p.created_at, p.id) < ($${params.length-1}, $${params.length})`);
  }

  params.push(limit);
  const { rows } = await db.query(`
    SELECT p.id, p.title, p.price, p.bedrooms, p.bathrooms,
           p.property_type, p.listing_type, p.city, p.address_line,
           p.latitude, p.longitude, p.images[1] AS thumbnail,
           p.status, p.created_at
    FROM properties p
    WHERE ${where.join(' AND ')}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT $${params.length}
  `, params);
  return rows;
}
```

Notice: uses `&&` (bbox overlap) on the geography column — matches the partial GiST index. Returns lat/lng from the generated columns (no per-row `ST_X`/`ST_Y`). Keyset cursor based on `(created_at, id)`. Thin projection.

---

## 7. Phase 6 — Repositories + Helpers

Add `backend/src/repositories/` only if a query needs to be reused across services (e.g. "give me a user with their active subscription"). For simple CRUD, models stay sufficient. Don't introduce a layer just for symmetry.

Add `backend/src/utils/sql.js` with two small helpers:
- `withTransaction(fn)` — checkout a client, BEGIN/COMMIT/ROLLBACK, release.
- `buildWhere(filters)` — turns `{ city: 'Bangalore', minPrice: 1000 }` into `(clause, params)`. Cuts the boilerplate in `property.model.js`.

---

## 8. Phase 7 — Verification

**A. Parity tests.** Before deleting the JSON store, run both backends side-by-side on the same JSON dataset and assert identical responses for:
- `GET /api/subscriptions/me` for every seeded user
- `GET /api/payments/history` for every seeded user
- `POST /api/properties` quota-deduction flow

A small Jest suite under `backend/tests/parity.test.js` is enough.

**B. Performance smoke.** Load 1M synthetic properties (Faker + `generate_series`) and run:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, price, latitude, longitude
FROM properties
WHERE status='active'
  AND location && ST_MakeEnvelope(77.5, 12.9, 77.7, 13.05, 4326)::geography
ORDER BY created_at DESC, id DESC
LIMIT 20;
```
Target: **< 50 ms** with cold cache, **< 10 ms** warm. If the planner picks Seq Scan instead of `idx_properties_location_active`, run `ANALYZE properties` and reduce `random_page_cost` toward 1.0.

**C. Connection-pool soak.** k6 or autocannon at 200 RPS for 5 minutes against the search endpoint. Watch `pg_stat_activity` for idle-in-transaction connections — there should be none.

---

## 9. Phase 8 — Cutover

1. Merge schema + import script behind a feature flag (`USE_PG=false` initially).
2. In staging: run `npm run db:migrate && npm run db:import`, flip flag, smoke-test.
3. In prod: same sequence during a low-traffic window. Keep the JSON files in `backend/db/data/` for one release as a rollback safety net.
4. Next release: delete `backend/db/data/`, delete the old JSON-cache code from history reference (it's already replaced in `database.js`), remove the feature flag.

**Rollback path:** revert to the previous Docker image. Because the old code reads JSON files that haven't been deleted yet, it Just Works. After the safety-net release, rollback requires restoring the JSON dump from a backup — at that point Postgres is the source of truth.

---

## 10. Performance Cheat Sheet (Pin to the Wall)

| Symptom | First thing to check |
|---|---|
| Slow `GET /api/properties` | `EXPLAIN ANALYZE` — is it using `idx_properties_location_active`? If not, run `ANALYZE`. |
| Slow `GET /api/properties/:id` | TOAST'd `description`/`images` columns — split into `properties_detail` table if needed. |
| INSERT latency rising | Too many indexes. Drop the ones with `idx_scan = 0` in `pg_stat_user_indexes`. |
| Connection exhaustion | Add pgBouncer (transaction-mode) in front of Postgres. |
| Heap > 50 GB | Time to enable partitioning (migration `008_partitioning.sql`). |
| Search results stale | Check trigger `trg_properties_updated_at` is firing; verify `search_doc` regenerates. |

---

*Once Phase 8 ships, `SYSTEM_DESIGN.md §10.2` Phase 1 is complete and the system is ready for the read-replica + Redis work in Phase 2.*
