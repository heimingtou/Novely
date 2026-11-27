// Connection admission check for the current read-only Foundation runtime.
// pg-pool awaits this hook before handing each new physical connection to Prisma.
const TRANSITION_TABLES = [
  "bookshelves", "chapter_contents", "chapter_likes", "chapters", "comments", "follows",
  "forum_category", "forum_comment", "forum_post", "forum_reaction", "forum_report",
  "genres", "interact_novel", "interact_novel_day", "novel_genres", "novel_likes",
  "novels", "profiles", "reading_progress", "reviews", "users",
];

export async function verifySupabaseConnection(client, config) {
  if (client.connection?.stream?.encrypted !== true || client.connection.stream.authorized !== true) {
    throw new Error("Database runtime TLS chưa được xác minh.");
  }
  const { rows: [identity] } = await client.query(`SELECT current_database() AS database,
    current_user AS role, current_setting('server_version_num')::integer AS version,
    current_setting('supabase.project_ref',true) AS project_ref,
    current_setting('default_transaction_read_only')='on' AS read_only,
    r.rolcanlogin AS login,r.rolsuper AS superuser,r.rolcreatedb AS create_database,
    r.rolcreaterole AS create_role,r.rolreplication AS replication,r.rolbypassrls AS bypass_rls,
    has_schema_privilege(current_user,'public','USAGE') AS public_usage,
    has_schema_privilege(current_user,'public','CREATE') AS public_create,
    has_table_privilege(current_user,'public.genres','SELECT') AS genres_select,
    EXISTS (SELECT 1 FROM pg_roles p WHERE
      (p.rolsuper OR p.rolcreatedb OR p.rolcreaterole OR p.rolreplication OR p.rolbypassrls
        OR p.rolname IN ('postgres','authenticator','anon','authenticated','service_role')
        OR p.rolname ~ '^(pg_|supabase_)')
      AND pg_has_role(current_user,p.oid,'MEMBER')) AS privileged_membership,
    EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
      AND c.relowner=r.oid) AS owns_application_relation,
    EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname !~ '^pg_'
      AND n.nspname NOT IN ('public','information_schema')
      AND (has_schema_privilege(current_user,n.oid,'USAGE')
        OR has_schema_privilege(current_user,n.oid,'CREATE'))) AS unexpected_schema_privileges,
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
      AND has_schema_privilege(current_user,n.oid,'USAGE') AND p.prosecdef
      AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS unsafe_function_access,
    EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
      AND has_schema_privilege(current_user,n.oid,'USAGE') AND
      CASE WHEN c.relkind='S' THEN has_sequence_privilege(current_user,c.oid,'USAGE,SELECT,UPDATE')
      WHEN c.relkind IN ('r','p','v','m','f') THEN
        has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES')
        OR ((n.nspname<>'public' OR c.relname<>'genres') AND has_any_column_privilege(current_user,c.oid,'SELECT'))
      ELSE false END) AS unexpected_data_privileges
    FROM pg_roles r WHERE r.rolname=current_user`);
  if (!identity || identity.database !== "postgres" || identity.role !== config.expectedIdentity.role
    || identity.version < 170000 || Math.floor(identity.version / 10000) !== 17
    || (identity.project_ref && identity.project_ref !== config.expectedIdentity.projectRef)
    || !identity.login || !identity.read_only || !identity.public_usage || !identity.genres_select
    || [identity.superuser, identity.create_database, identity.create_role, identity.replication,
      identity.bypass_rls, identity.public_create, identity.privileged_membership,
      identity.owns_application_relation, identity.unexpected_schema_privileges,
      identity.unsafe_function_access, identity.unexpected_data_privileges].some((value) => value !== false)) {
    throw new Error("Database runtime identity hoặc quyền vượt phạm vi Foundation; kết nối bị từ chối.");
  }
  const { rows } = await client.query(`SELECT tablename::text AS name FROM pg_tables
    WHERE schemaname='public' ORDER BY tablename`);
  if (JSON.stringify(rows.map((row) => row.name)) !== JSON.stringify(TRANSITION_TABLES)) {
    throw new Error("Database runtime chưa có đúng schema chuyển tiếp 21 bảng đã nghiệm thu.");
  }
}
