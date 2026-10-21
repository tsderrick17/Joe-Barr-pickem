-- Supabase stops granting Data API access to NEW public tables automatically on
-- 2026-10-30. Server routes use the service role, so it must hold explicit
-- privileges on everything in the public schema, whatever the platform default.
-- This catch-up is idempotent and only widens access for the trusted server
-- role; anon and authenticated keep exactly the grants each migration declares.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Keep tables, sequences and functions created later by migrations usable too.
-- The platform may reset its own default privileges, so every migration that
-- creates a table also grants it explicitly (a test enforces that from here on).
alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public
  grant all privileges on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
