-- The Data API roles must be able to resolve objects in the exposed public
-- schema. Object-level grants and row-level security remain the authorization
-- boundary; USAGE alone does not grant access to any table or function.
grant usage on schema public to anon, authenticated, service_role;

-- Server routes and isolated certification use the service role for trusted
-- lifecycle work. Restore that role without broadening anon/authenticated.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Keep newly created application tables usable by server automation. Client
-- roles continue to receive only the explicit grants declared per migration.
alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public
  grant all privileges on sequences to service_role;
