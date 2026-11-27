-- READ ONLY after migration. Every row must have non_owner_grants=0.
-- Owner privileges are intentional. Also run supabase-access-audit.sql to
-- detect effective privileges through role memberships (not only direct ACLs).
SELECT 'new_object_acl' AS audit,c.relname AS object_name,
  count(a.grantee) FILTER (WHERE a.grantee<>c.relowner)::integer AS non_owner_grants
FROM pg_class c LEFT JOIN LATERAL aclexplode(COALESCE(c.relacl,
  acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) a ON true
WHERE c.relnamespace='public'::regnamespace AND c.relname IN
  ('forum_category','forum_post','forum_comment','forum_reaction','forum_report',
   'forum_category_category_id_seq','forum_post_post_id_seq','forum_comment_comment_id_seq','forum_report_report_id_seq')
GROUP BY c.oid,c.relname
UNION ALL
SELECT 'new_object_acl',p.proname,
  count(a.grantee) FILTER (WHERE a.grantee<>p.proowner)::integer
FROM pg_proc p LEFT JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a ON true
WHERE p.pronamespace='public'::regnamespace AND p.pronargs=0
  AND p.proname IN ('novely_sync_legacy_content','novely_sync_chapter_content')
GROUP BY p.oid,p.proname ORDER BY object_name;
