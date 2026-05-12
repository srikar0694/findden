-- 002_enums.sql
-- Enums for role/type/status fields. Wrapped in DO blocks so reruns
-- don't error when the type already exists.

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('buyer', 'agent', 'owner', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE property_type AS ENUM (
    'apartment', 'house', 'villa', 'plot', 'commercial', 'pg'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE property_status AS ENUM (
    'draft', 'pending_payment', 'active', 'paused', 'sold', 'rented', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM (
    'active', 'expired', 'cancelled', 'paused'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM (
    'pending', 'success', 'failed', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
