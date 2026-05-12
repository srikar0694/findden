-- 001_extensions.sql
-- Postgres extensions required by the FindDen schema.
--   postgis      → geography(Point,4326) + GiST indexes for the map search
--   uuid-ossp    → uuid_generate_v4() for primary keys
--   pg_trgm      → trigram index for "city LIKE 'bang%'" autosuggest
--   btree_gist   → lets us combine b-tree + GiST columns in one index later

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
