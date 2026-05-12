-- 006_properties.sql
-- The hot table. Tuned for 10M+ rows.
--
-- Generated columns:
--   latitude/longitude  → cheap projection in the list endpoint, no ST_X/ST_Y per row.
--   search_doc          → tsvector with weighted title/city/address for FTS.
--
-- Index strategy is described in MIGRATION_PLAN.md §4.4.

CREATE TABLE IF NOT EXISTS properties (
  id                UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(255)    NOT NULL,
  description       TEXT,
  property_type     property_type   NOT NULL,
  status            property_status NOT NULL DEFAULT 'draft',
  listing_type      VARCHAR(10)     NOT NULL CHECK (listing_type IN ('sale','rent')),
  price             NUMERIC(14,2)   NOT NULL CHECK (price >= 0),
  price_negotiable  BOOLEAN         NOT NULL DEFAULT FALSE,
  bedrooms          SMALLINT,
  bathrooms         SMALLINT,
  area_sqft         NUMERIC(10,2),
  furnishing        VARCHAR(20)     CHECK (furnishing IN ('unfurnished','semi','furnished')),
  floor             SMALLINT,
  total_floors      SMALLINT,
  address_line      TEXT            NOT NULL,
  city              VARCHAR(100)    NOT NULL,
  state             VARCHAR(100)    NOT NULL,
  pincode           VARCHAR(10)     NOT NULL,
  location          GEOGRAPHY(Point, 4326) NOT NULL,
  images            TEXT[]          NOT NULL DEFAULT '{}',
  amenities         TEXT[]          NOT NULL DEFAULT '{}',
  available_from    DATE,
  views_count       INT             NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- Pre-extracted lat/lng. Avoids ST_X/ST_Y per row on the list endpoint.
  latitude          DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED,
  longitude         DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(location::geometry)) STORED,

  -- Full-text search document. A=title, B=city, C=address.
  search_doc        tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title,'')),        'A') ||
    setweight(to_tsvector('simple', coalesce(city,'')),         'B') ||
    setweight(to_tsvector('simple', coalesce(address_line,'')), 'C')
  ) STORED
);

-- ─── Indexes ──────────────────────────────────────────────────────────────
-- (a) The map query: bounding-box on active listings = 95% of read traffic.
--     Partial GiST is significantly smaller and faster than a full one.
CREATE INDEX IF NOT EXISTS idx_properties_location_active
  ON properties USING GIST (location)
  WHERE status = 'active';

-- (b) Full-text search across title/city/address.
CREATE INDEX IF NOT EXISTS idx_properties_search_doc
  ON properties USING GIN (search_doc);

-- (c) Common filter combination — high-cardinality column first.
CREATE INDEX IF NOT EXISTS idx_properties_filter
  ON properties (city, listing_type, property_type, status);

-- (d) Price range filter on active listings only.
CREATE INDEX IF NOT EXISTS idx_properties_price_active
  ON properties (price)
  WHERE status = 'active';

-- (e) Owner dashboard ("my listings, newest first").
CREATE INDEX IF NOT EXISTS idx_properties_owner_created
  ON properties (owner_id, created_at DESC);

-- (f) Keyset pagination on the home feed.
CREATE INDEX IF NOT EXISTS idx_properties_active_recent
  ON properties (created_at DESC, id DESC)
  WHERE status = 'active';

-- (g) Trigram index for "city LIKE 'bang%'" autosuggest.
CREATE INDEX IF NOT EXISTS idx_properties_city_trgm
  ON properties USING GIN (city gin_trgm_ops);
