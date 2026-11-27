-- Approved scope on 2026-11-27: runtime role plus an isolated genres SELECT
-- policy when required by RLS. This reference file keeps ROLLBACK for safety.
-- Role and policy have been committed and verified. Do not rerun this file.
-- Final ROLLBACK is intentional. After approval, provision a random password
-- in memory and store it only in an external runtime env, never SQL/logs/Git.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='15s';

DO $identity$
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres'
    OR current_setting('server_version_num')::integer<>170012
    OR (NULLIF(current_setting('supabase.project_ref',true),'') IS NOT NULL
      AND current_setting('supabase.project_ref',true)<>'sctbtzvlzrhrhqveceln') THEN
    RAISE EXCEPTION 'STOP: wrong reviewed production target';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='novely_backend') THEN
    RAISE EXCEPTION 'STOP: novely_backend already exists; review it instead of changing its privileges';
  END IF;
END;
$identity$;

CREATE ROLE novely_backend LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
GRANT CONNECT ON DATABASE postgres TO novely_backend;
GRANT USAGE ON SCHEMA public TO novely_backend;
GRANT SELECT ON TABLE public.genres TO novely_backend;
ALTER ROLE novely_backend IN DATABASE postgres SET default_transaction_read_only=on;
ALTER ROLE novely_backend IN DATABASE postgres SET search_path=pg_catalog,public;
ALTER ROLE novely_backend IN DATABASE postgres SET timezone='UTC';
ALTER ROLE novely_backend IN DATABASE postgres SET statement_timeout='15s';

DO $genres_policy$
BEGIN
  IF (SELECT relrowsecurity FROM pg_class WHERE oid='public.genres'::regclass) THEN
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.genres'::regclass) THEN
      RAISE EXCEPTION 'STOP: genres policies changed since the reviewed empty-policy audit';
    END IF;
    CREATE POLICY novely_backend_genres_select ON public.genres
      AS PERMISSIVE FOR SELECT TO novely_backend USING (true);
  END IF;
END;
$genres_policy$;

-- No owner change, role membership, BYPASSRLS, schema CREATE, sequence permission,
-- DML, Forum permission or global/default ACL change. Next.js grants are unchanged.
-- The new SELECT policy names only novely_backend; existing policies are untouched.
-- Baseline PUBLIC CONNECT/TEMPORARY and catalog access are not modified.
-- Foundation exposes liveness/readiness only; genres SELECT allows a real,
-- aggregate read through the generated Prisma Client without reading user data.
-- BE03 permissions must be reviewed against its actual endpoints, not pre-granted.
SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,
  rolreplication,rolbypassrls,rolconnlimit
FROM pg_roles WHERE rolname='novely_backend';

ROLLBACK;
