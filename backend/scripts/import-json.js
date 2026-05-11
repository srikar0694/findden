#!/usr/bin/env node
/**
 * Import the legacy JSON snapshots in db/data/ into PostgreSQL.
 *
 * Order of operations:
 *   1. plans         — upserted from plans.json. IDs are TEXT, used as-is.
 *   2. users         — from users.json if present; auto-stubbed for any
 *                      user_id referenced by subscriptions/transactions.
 *   3. subscriptions — plan_id is the literal string from plans.json.
 *   4. properties    — from properties.json if present (lat/lng → geography).
 *   5. transactions  — rewriting user_id, subscription_id, property_id.
 *
 * The whole import runs inside one transaction. Either everything lands
 * or nothing does.
 *
 * Usage:
 *   npm run db:import
 *
 * Idempotency: ON CONFLICT (id) clauses make a re-run safe — it will
 * upsert plans and skip everything else that already exists.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, '..', 'db', 'data');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Deterministic UUIDv5-style derivation so the same legacy id maps to the
// same UUID across re-runs. Used for users / subscriptions / properties /
// transactions, all of which still use UUID primary keys. NOT used for
// plans — those keep their human-readable string IDs.
function deriveUuid(namespace, legacyId) {
  const hash = crypto.createHash('sha1').update(`${namespace}:${legacyId}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join('-');
}

function readJson(name) {
  const fp = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

async function importPlans(client) {
  const plans = readJson('plans') || [];
  let inserted = 0;
  for (const p of plans) {
    const r = await client.query(`
      INSERT INTO plans (
        id, name, slug, description, tagline, price, currency,
        unlock_quota, duration_days, billing_cycle, tier,
        features, highlight, display_order, is_active, created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,
        $12::jsonb,$13,$14,$15,
        COALESCE($16::timestamptz, NOW())
      )
      ON CONFLICT (id) DO UPDATE SET
        name          = EXCLUDED.name,
        slug          = EXCLUDED.slug,
        description   = EXCLUDED.description,
        tagline       = EXCLUDED.tagline,
        price         = EXCLUDED.price,
        currency      = EXCLUDED.currency,
        unlock_quota  = EXCLUDED.unlock_quota,
        duration_days = EXCLUDED.duration_days,
        billing_cycle = EXCLUDED.billing_cycle,
        tier          = EXCLUDED.tier,
        features      = EXCLUDED.features,
        highlight     = EXCLUDED.highlight,
        display_order = EXCLUDED.display_order,
        is_active     = EXCLUDED.is_active
    `, [
      p.id, p.name, p.slug, p.description || null, p.tagline || null,
      p.price, p.currency || 'INR',
      p.unlock_quota, p.duration_days ?? null, p.billing_cycle, p.tier,
      JSON.stringify(p.features || []),
      !!p.highlight, p.display_order ?? 0,
      p.is_active !== false, p.created_at || null,
    ]);
    inserted += r.rowCount;
  }
  return { inserted };
}

async function importUsers(client, referencedUserIds) {
  const users = readJson('users') || [];
  const userIdMap = {};

  for (const u of users) {
    const id = deriveUuid('user', u.id);
    userIdMap[u.id] = id;
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, phone, is_verified, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz, NOW()))
      ON CONFLICT (id) DO NOTHING
    `, [id, u.name, u.email, u.password_hash || 'imported',
        u.role || 'buyer', u.phone || null, !!u.is_verified, u.created_at || null]);
  }

  // Stub out users referenced by subscriptions/transactions but missing from users.json.
  for (const legacyId of referencedUserIds) {
    if (userIdMap[legacyId]) continue;
    const id = deriveUuid('user', legacyId);
    userIdMap[legacyId] = id;
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES ($1,$2,$3,'imported-stub',$4)
      ON CONFLICT (id) DO NOTHING
    `, [id, `Imported ${legacyId}`, `${legacyId}@imported.local`,
        legacyId.includes('agent') ? 'agent'
        : legacyId.includes('owner') ? 'owner'
        : legacyId.includes('admin') ? 'admin' : 'buyer']);
  }

  return userIdMap;
}

async function importSubscriptions(client, userIdMap, knownPlanIds) {
  const subs = readJson('subscriptions') || [];
  const subIdMap = {};
  let inserted = 0;
  let skipped = 0;

  for (const s of subs) {
    const id = deriveUuid('sub', s.id);
    subIdMap[s.id] = id;
    const userId = userIdMap[s.user_id];

    if (!userId) { skipped++; continue; }
    if (!knownPlanIds.has(s.plan_id)) {
      // Subscription references a plan that isn't in plans.json — skip
      // rather than violate the FK.
      skipped++;
      continue;
    }

    const r = await client.query(`
      INSERT INTO subscriptions
        (id, user_id, plan_id, quota_used, starts_at, expires_at, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7,
              COALESCE($8::timestamptz, NOW()),
              COALESCE($9::timestamptz, NOW()))
      ON CONFLICT (id) DO NOTHING
    `, [id, userId, s.plan_id, s.quota_used || 0,
        s.starts_at, s.expires_at || null,
        s.status || 'active', s.created_at, s.updated_at]);
    inserted += r.rowCount;
  }

  return { subIdMap, inserted, skipped };
}

async function importProperties(client, userIdMap) {
  const props = readJson('properties') || [];
  const propIdMap = {};
  let inserted = 0;
  let skipped = 0;

  for (const p of props) {
    const id = deriveUuid('property', p.id);
    propIdMap[p.id] = id;
    const ownerId = userIdMap[p.owner_id];
    if (!ownerId) { skipped++; continue; }

    const r = await client.query(`
      INSERT INTO properties (
        id, owner_id, title, description, property_type, status, listing_type,
        price, price_negotiable, bedrooms, bathrooms, area_sqft, furnishing,
        floor, total_floors, address_line, city, state, pincode,
        location, images, amenities, available_from, views_count, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,
        ST_SetSRID(ST_MakePoint($20::float, $21::float), 4326)::geography,
        $22,$23,$24,$25,
        COALESCE($26::timestamptz, NOW()), COALESCE($27::timestamptz, NOW())
      )
      ON CONFLICT (id) DO NOTHING
    `, [
      id, ownerId, p.title, p.description || null, p.property_type,
      p.status || 'draft', p.listing_type, p.price, !!p.price_negotiable,
      p.bedrooms ?? null, p.bathrooms ?? null, p.area_sqft ?? null, p.furnishing ?? null,
      p.floor ?? null, p.total_floors ?? null, p.address_line, p.city, p.state, p.pincode,
      p.longitude, p.latitude,
      p.images || [], p.amenities || [], p.available_from || null, p.views_count || 0,
      p.created_at, p.updated_at,
    ]);
    inserted += r.rowCount;
  }
  return { propIdMap, inserted, skipped };
}

async function importTransactions(client, userIdMap, subIdMap, propIdMap) {
  const txns = readJson('transactions') || [];
  let inserted = 0;
  let skipped = 0;

  for (const t of txns) {
    const id = deriveUuid('txn', t.id);
    const userId = userIdMap[t.user_id];
    const subId  = t.subscription_id ? subIdMap[t.subscription_id]  : null;
    const propId = t.property_id     ? propIdMap[t.property_id]     : null;

    if (!userId) { skipped++; continue; }
    // The XOR check constraint requires exactly one of sub/prop.
    if (!subId && !propId) { skipped++; continue; }
    if (subId && propId)   { skipped++; continue; }

    const r = await client.query(`
      INSERT INTO transactions
        (id, user_id, subscription_id, property_id, amount, currency, status,
         payment_gateway, payment_ref, metadata, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,
              COALESCE($11::timestamptz, NOW()),
              COALESCE($12::timestamptz, NOW()))
      ON CONFLICT (id) DO NOTHING
    `, [id, userId, subId, propId, t.amount, t.currency || 'INR',
        t.status || 'success', t.payment_gateway || null, t.payment_ref || null,
        JSON.stringify(t.metadata || {}), t.created_at, t.updated_at]);
    inserted += r.rowCount;
  }
  return { inserted, skipped };
}

(async () => {
  const client = await pool.connect();
  console.log('--- FindDen JSON → Postgres import ---');
  console.log(`source: ${DATA_DIR}`);

  try {
    await client.query('BEGIN');

    // Collect every user_id mentioned anywhere so we can stub missing users.
    const subs = readJson('subscriptions') || [];
    const txns = readJson('transactions') || [];
    const referencedUsers = new Set([
      ...subs.map((s) => s.user_id),
      ...txns.map((t) => t.user_id),
    ].filter(Boolean));

    const plans = await importPlans(client);
    console.log(`plans:         upserted ${plans.inserted}`);

    // Build the set of plan IDs that exist in the DB so subscriptions
    // can be filtered against missing FKs without round-tripping per row.
    const { rows: planRows } = await client.query(`SELECT id FROM plans`);
    const knownPlanIds = new Set(planRows.map((r) => r.id));

    const userMap = await importUsers(client, referencedUsers);
    console.log(`users:         ${Object.keys(userMap).length} mapped`);

    const subRes  = await importSubscriptions(client, userMap, knownPlanIds);
    console.log(`subscriptions: +${subRes.inserted} (skipped ${subRes.skipped})`);

    const propRes = await importProperties(client, userMap);
    console.log(`properties:    +${propRes.inserted} (skipped ${propRes.skipped})`);

    const txnRes  = await importTransactions(client, userMap, subRes.subIdMap, propRes.propIdMap);
    console.log(`transactions:  +${txnRes.inserted} (skipped ${txnRes.skipped})`);

    await client.query('COMMIT');
    console.log('✓ import complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ import rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
