-- Supabase compatibility shims for vanilla PostgreSQL CI
-- Creates the auth schema and stub functions/tables that Supabase provides
-- but that don't exist in a stock postgres:17 container.
-- This file is run BEFORE migrations in the Postgres 17 compatibility check.

CREATE SCHEMA IF NOT EXISTS auth;

-- auth.uid() is called inside RLS USING clauses (migrations 001, 005)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULL::uuid;
$$;

-- auth.role() is called inside RLS USING clauses (migration 005)
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT 'authenticated'::text;
$$;

-- auth.users is referenced by the trigger in migration 006
CREATE TABLE IF NOT EXISTS auth.users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text,
  raw_user_meta_data   jsonb DEFAULT '{}'
);
