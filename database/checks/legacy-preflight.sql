-- READ ONLY, before migration. A false gate requires STOP/review, not repair.
-- Broad default ACLs in the provided Supabase audit are handled per new object
-- by the pending migration. Do not revoke legacy ACLs or change defaults here.
-- Local already migrated: legacy_16_tables/content_not_added/scoped_trigger
-- correctly report false. PostgreSQL 17 gate is verified only on PG17 staging.
WITH tables AS (
  SELECT array_agg(tablename::text ORDER BY tablename) AS names FROM pg_catalog.pg_tables WHERE schemaname='public'
), chapter_trigger AS (
  SELECT t.tgtype,t.tgenabled,t.tgfoid,t.tgqual,t.tgnargs,
    ARRAY(SELECT a.attname::text FROM pg_catalog.pg_attribute a
      WHERE a.attrelid=t.tgrelid AND a.attnum=ANY(t.tgattr) ORDER BY a.attname) AS columns
  FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.chapters'::regclass AND t.tgname='trg_chapters_updated'
)
SELECT 'legacy_preflight' AS audit,current_database() AS database_name,
  current_user AS migration_role,current_setting('server_version') AS server_version,
  current_setting('server_version_num')::integer/10000=17 AS is_postgresql_17,
  names=ARRAY['bookshelves','chapter_contents','chapter_likes','chapters','comments',
    'follows','genres','interact_novel','interact_novel_day','novel_genres','novel_likes',
    'novels','profiles','reading_progress','reviews','users'] AS legacy_16_tables,
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='chapters' AND column_name='content') AS content_not_added,
  COALESCE((SELECT tgtype=19 AND tgenabled='O' AND tgfoid='public.set_updated_at()'::regprocedure
    AND tgqual IS NULL AND tgnargs=0 AND columns=ARRAY['chapter_number','novel_id','published_at','status','title','word_count']
    FROM chapter_trigger),false) AS scoped_timestamp_trigger,
  (SELECT count(*)::integer FROM public.chapters c LEFT JOIN public.chapter_contents cc USING(chapter_id) WHERE cc.chapter_id IS NULL) AS missing_contents,
  (SELECT count(*)::integer FROM public.comments c JOIN public.comments p ON p.comment_id=c.parent_id WHERE c.chapter_id<>p.chapter_id) AS cross_chapter_parents,
  (SELECT count(*)::integer FROM pg_catalog.pg_proc p WHERE p.pronamespace='public'::regnamespace
    AND p.pronargs=0 AND p.proname IN ('recalc_counters','set_updated_at','trg_chapter_likes_count','trg_comments_count','trg_follows_count','trg_novel_likes_count')) AS legacy_functions,
  (SELECT count(*)::integer FROM pg_catalog.pg_indexes WHERE schemaname='public') AS indexes,
  (SELECT count(*)::integer FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal) AS triggers,
  (SELECT count(*)::integer FROM public.novels n LEFT JOIN public.interact_novel i USING(novel_id) WHERE i.novel_id IS NULL) AS missing_statistics
FROM tables;
