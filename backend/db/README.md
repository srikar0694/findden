# Database — FindDen

PostgreSQL 15 + PostGIS 3.4. Schema lives in `db/migrations/`, baseline data in `db/seeds/`, and the legacy JSON snapshots are in `db/data/` (read by `scripts/import-json.js`).

## First-time setup

```bash
# 1. Start Postgres + PostGIS
npm run db:up

# 2. Apply schema migrations
npm run db:migrate

# 3. Seed the three pricing plans
npm run db:seed

# 4. Import the legacy JSON dump (subscriptions, transactions, ...)
npm run db:import
```

To wipe and rebuild everything from scratch:

```bash
npm run db:reset
```

## Day-to-day commands

| Command | What it does |
|---|---|
| `npm run db:up` | Start the Postgres container in the background |
| `npm run db:down` | Stop the container (data persists in the named volume) |
| `npm run db:migrate` | Apply every unapplied `.sql` in `db/migrations/` |
| `npm run db:seed` | Apply every `.sql` in `db/seeds/` |
| `npm run db:import` | One-shot import of `db/data/*.json` |
| `node db/migrate.js status` | Show applied vs pending migrations |

## Writing a new migration

1. Create `db/migrations/00X_short_name.sql` with the next number.
2. Use `IF NOT EXISTS` / `IF EXISTS` / `DO $$ … EXCEPTION` so reruns are safe.
3. Each migration runs inside its own transaction — keep DDL only; defer data backfills to a separate script if they're long-running.
4. Never edit a migration that has been applied to any environment. Write a new forward migration instead.

## Connecting manually

```bash
psql "$DATABASE_URL"
```

Or directly into the container:

```bash
docker exec -it findden-pg psql -U findden -d findden
```

## Useful inspection queries

```sql
-- Verify PostGIS is loaded
SELECT PostGIS_Version();

-- See which migrations have been applied
SELECT * FROM schema_migrations ORDER BY applied_at;

-- Check index usage on the hot table
SELECT indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE relname = 'properties'
ORDER BY idx_scan DESC;

-- Plan a map query
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, price, latitude, longitude
FROM properties
WHERE status = 'active'
  AND location && ST_MakeEnvelope(77.5, 12.9, 77.7, 13.05, 4326)::geography
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

## Files in this folder

```
db/
├── README.md                  ← this file
├── migrate.js                 ← migration runner CLI
├── data/                      ← legacy JSON snapshots (input to import-json.js)
├── migrations/
│   ├── 001_extensions.sql     ← postgis, uuid-ossp, pg_trgm, btree_gist
│   ├── 002_enums.sql          ← user_role, property_type, …
│   ├── 003_users.sql
│   ├── 004_plans.sql
│   ├── 005_subscriptions.sql
│   ├── 006_properties.sql     ← THE hot table — generated cols + 7 indexes
│   ├── 007_transactions.sql   ← XOR check on subscription_id / property_id
│   └── 008_audit_triggers.sql ← updated_at refresh on every row update
└── seeds/
    └── 01_plans.seed.sql      ← Starter / Pro / Enterprise
```
