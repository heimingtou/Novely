-- READ ONLY, as the approved audit role. Never select rolpassword or pg_authid.
-- Run inside BEGIN READ ONLY with a bounded statement_timeout.
SELECT r.rolname,r.rolcanlogin,r.rolsuper,r.rolcreatedb,r.rolcreaterole,
  r.rolreplication,r.rolbypassrls,
  has_schema_privilege(r.oid,'public','USAGE') AS public_usage,
  has_schema_privilege(r.oid,'public','CREATE') AS public_create,
  has_table_privilege(r.oid,'public.genres','SELECT') AS genres_select,
  ARRAY(SELECT parent.rolname FROM pg_auth_members m
    JOIN pg_roles parent ON parent.oid=m.roleid
    WHERE m.member=r.oid ORDER BY parent.rolname) AS memberships
FROM pg_roles r WHERE r.rolname NOT LIKE 'pg_%' ORDER BY r.rolname;
