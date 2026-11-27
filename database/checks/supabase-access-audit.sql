-- READ ONLY: catalog/privilege checks only, before and after migration.
-- Run as the approved migration role, inside BEGIN READ ONLY when standalone.
-- Missing Supabase roles/tables are reported, never created or granted access.

WITH targets(role_name) AS (
  VALUES ('anon'),('authenticated'),('service_role')
  UNION SELECT current_user::text
)
SELECT 'roles' AS audit,t.role_name,r.oid IS NOT NULL AS present,
  r.rolsuper AS superuser,r.rolbypassrls AS bypass_rls
FROM targets t LEFT JOIN pg_catalog.pg_roles r ON r.rolname=t.role_name
ORDER BY t.role_name;

SELECT 'schema_privileges' AS audit,r.rolname AS role_name,
  has_schema_privilege(r.oid,'public','USAGE') AS can_use_public,
  has_schema_privilege(r.oid,'public','CREATE') AS can_create_in_public
FROM pg_catalog.pg_roles r
WHERE r.rolname IN ('anon','authenticated','service_role',current_user)
ORDER BY r.rolname;

WITH targets(table_name) AS (VALUES
  ('forum_category'),('forum_post'),('forum_comment'),('forum_reaction'),('forum_report')
)
SELECT 'forum_state' AS audit,t.table_name,c.oid IS NOT NULL AS present,
  pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls,
  (SELECT count(*)::integer FROM pg_catalog.pg_policy p WHERE p.polrelid=c.oid) AS policy_count
FROM targets t LEFT JOIN pg_catalog.pg_class c
  ON c.relnamespace='public'::regnamespace AND c.relname=t.table_name AND c.relkind='r'
ORDER BY t.table_name;

WITH targets(table_name) AS (VALUES
  ('chapters'),('chapter_contents'),('forum_category'),('forum_post'),
  ('forum_comment'),('forum_reaction'),('forum_report')
), roles AS (
  SELECT oid,rolname FROM pg_catalog.pg_roles
  WHERE rolname IN ('anon','authenticated','service_role',current_user)
)
SELECT 'effective_table_privileges' AS audit,r.rolname AS role_name,t.table_name,
  c.oid IS NOT NULL AS present,
  has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
  has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,
  has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,
  has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete,
  has_table_privilege(r.oid,c.oid,'TRUNCATE') AS can_truncate,
  has_table_privilege(r.oid,c.oid,'REFERENCES') AS can_reference,
  has_table_privilege(r.oid,c.oid,'TRIGGER') AS can_create_trigger
FROM roles r CROSS JOIN targets t LEFT JOIN pg_catalog.pg_class c
  ON c.relnamespace='public'::regnamespace AND c.relname=t.table_name AND c.relkind='r'
ORDER BY r.rolname,t.table_name;

-- Invoker synchronization needs SELECT/UPDATE chapter content and
-- SELECT/INSERT/UPDATE legacy content. Report column grants as well as table grants.
WITH targets(table_name,column_name) AS (VALUES
  ('chapters','chapter_id'),('chapters','content'),('chapter_contents','chapter_id'),
  ('chapter_contents','content')
), roles AS (
  SELECT oid,rolname FROM pg_catalog.pg_roles
  WHERE rolname IN ('anon','authenticated','service_role',current_user)
)
SELECT 'content_column_privileges' AS audit,r.rolname AS role_name,t.table_name,t.column_name,
  a.attnum IS NOT NULL AS present,
  has_column_privilege(r.oid,c.oid,a.attnum,'SELECT') AS can_select,
  has_column_privilege(r.oid,c.oid,a.attnum,'INSERT') AS can_insert,
  has_column_privilege(r.oid,c.oid,a.attnum,'UPDATE') AS can_update
FROM roles r CROSS JOIN targets t LEFT JOIN pg_catalog.pg_class c
  ON c.relnamespace='public'::regnamespace AND c.relname=t.table_name AND c.relkind='r'
LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname=t.column_name
  AND a.attnum>0 AND NOT a.attisdropped
ORDER BY r.rolname,t.table_name,t.column_name;

SELECT 'forum_identity_sequence_privileges' AS audit,r.rolname AS role_name,
  c.relname AS table_name,a.attname AS column_name,s.sequence_name,
  has_sequence_privilege(r.oid,s.sequence_name,'USAGE') AS can_use_sequence,
  has_sequence_privilege(r.oid,s.sequence_name,'SELECT') AS can_read_sequence,
  has_sequence_privilege(r.oid,s.sequence_name,'UPDATE') AS can_change_sequence
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
CROSS JOIN LATERAL (SELECT pg_get_serial_sequence(format('public.%I',c.relname),a.attname) AS sequence_name) s
CROSS JOIN pg_catalog.pg_roles r
WHERE c.relnamespace='public'::regnamespace
  AND c.relname IN ('forum_category','forum_post','forum_comment','forum_report')
  AND a.attidentity<>'' AND NOT a.attisdropped
  AND r.rolname IN ('anon','authenticated','service_role',current_user)
ORDER BY r.rolname,c.relname;

WITH targets(function_name) AS (VALUES
  ('set_updated_at'),('novely_sync_legacy_content'),('novely_sync_chapter_content')
)
SELECT 'trigger_function_privileges' AS audit,r.rolname AS role_name,t.function_name,
  p.oid IS NOT NULL AS present,p.prosecdef AS security_definer,
  has_function_privilege(r.oid,p.oid,'EXECUTE') AS can_execute,
  EXISTS (SELECT 1 FROM unnest(p.proconfig) setting WHERE setting='search_path=pg_catalog') AS catalog_only_search_path
FROM targets t CROSS JOIN pg_catalog.pg_roles r LEFT JOIN pg_catalog.pg_proc p
  ON p.pronamespace='public'::regnamespace AND p.proname=t.function_name AND p.pronargs=0
WHERE r.rolname IN ('anon','authenticated','service_role',current_user)
ORDER BY r.rolname,t.function_name;

-- Explicit global/public default ACL entries for every creator role. They are
-- creator-specific: membership in another role does not inherit its defaults.
SELECT 'explicit_default_privileges' AS audit,pg_get_userbyid(d.defaclrole) AS creator,
  CASE WHEN d.defaclnamespace=0 THEN '(global)' ELSE n.nspname::text END AS scope,
  d.defaclobjtype AS object_type,
  CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END AS grantee,
  acl.privilege_type,acl.is_grantable
FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
WHERE (d.defaclnamespace=0 OR n.nspname='public') AND d.defaclobjtype IN ('r','S','f')
ORDER BY creator,scope,object_type,grantee,privilege_type;

-- Effective default ACL components for objects created by current_user:
-- global explicit ACL OR built-in default, plus the public-schema additions.
WITH kinds(kind) AS (VALUES ('r'::"char"),('S'::"char"),('f'::"char")), base AS (
  SELECT k.kind,COALESCE(d.defaclacl,acldefault(k.kind,current_user::regrole)) AS acl
  FROM kinds k LEFT JOIN pg_catalog.pg_default_acl d
    ON d.defaclrole=current_user::regrole AND d.defaclnamespace=0 AND d.defaclobjtype=k.kind
), components AS (
  SELECT kind,'global_or_builtin' AS scope,acl FROM base
  UNION ALL
  SELECT defaclobjtype,'public_addition',defaclacl FROM pg_catalog.pg_default_acl
  WHERE defaclrole=current_user::regrole AND defaclnamespace='public'::regnamespace
    AND defaclobjtype IN ('r','S','f')
)
SELECT 'migration_role_default_components' AS audit,current_user AS creator,
  c.kind AS object_type,c.scope,
  CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
  a.privilege_type,a.is_grantable
FROM components c CROSS JOIN LATERAL aclexplode(c.acl) a
ORDER BY object_type,scope,grantee,privilege_type;

SELECT 'forum_policies' AS audit,schemaname,tablename,policyname,permissive,roles,cmd
FROM pg_catalog.pg_policies WHERE schemaname='public'
  AND tablename IN ('forum_category','forum_post','forum_comment','forum_reaction','forum_report')
ORDER BY tablename,policyname;

SELECT 'comments_relationships' AS audit,x.conname AS constraint_name,
  pg_get_constraintdef(x.oid,true) AS definition,x.convalidated AS validated
FROM pg_catalog.pg_constraint x WHERE x.conrelid='public.comments'::regclass AND x.contype='f'
ORDER BY x.conname;
