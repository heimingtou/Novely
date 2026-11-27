-- READ ONLY, after migration, inside the same transaction before COMMIT/ROLLBACK.
-- REQUIRED companion: new-object-permissions.sql must return 11 owner-only rows;
-- supabase-access-audit.sql must also show no effective rights for app roles on
-- the new objects. Its legacy-table rights are observations, not modified here.
SELECT 'expanded_catalog' AS audit,
  (SELECT count(*)::integer FROM pg_catalog.pg_tables WHERE schemaname='public') AS tables,
  (SELECT count(*)::integer FROM pg_catalog.pg_indexes WHERE schemaname='public') AS indexes,
  (SELECT count(*)::integer FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal) AS triggers,
  (SELECT count(*)::integer FROM pg_catalog.pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prorettype='trigger'::regtype) AS trigger_functions,
  (SELECT count(*)::integer FROM pg_catalog.pg_sequences WHERE schemaname='public') AS identity_sequences,
  (SELECT count(*)::integer FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indrelid
    WHERE c.relnamespace='public'::regnamespace AND (NOT i.indisvalid OR NOT i.indisready)) AS invalid_indexes;

SELECT 'expanded_data' AS audit,
  (SELECT count(*)::integer FROM public.chapters c JOIN public.chapter_contents cc USING(chapter_id)
    WHERE convert_to(c.content,'UTF8') IS DISTINCT FROM convert_to(cc.content,'UTF8')) AS content_mismatches,
  (SELECT count(*)::integer FROM public.chapters c LEFT JOIN public.chapter_contents cc USING(chapter_id)
    WHERE cc.chapter_id IS NULL) AS missing_contents,
  (SELECT count(*)::integer FROM public.bookshelves WHERE reading_status IS NOT NULL) AS unexpected_inferred_statuses,
  (SELECT count(*)::integer FROM public.bookshelves WHERE updated_at IS DISTINCT FROM saved_at) AS library_timestamp_mismatches,
  (SELECT count(*)::integer FROM public.reviews WHERE updated_at IS DISTINCT FROM created_at) AS review_timestamp_mismatches,
  (SELECT count(*)::integer FROM public.reading_progress WHERE scroll_position<>0) AS unexpected_backfilled_scroll,
  (SELECT count(*)::integer FROM public.comments c JOIN public.comments p ON p.comment_id=c.parent_id WHERE c.chapter_id<>p.chapter_id) AS cross_chapter_parents,
  (SELECT count(*)::integer FROM public.novels n LEFT JOIN public.interact_novel i USING(novel_id) WHERE i.novel_id IS NULL) AS missing_statistics;

SELECT 'forum_empty' AS audit,
  (SELECT count(*)::integer FROM public.forum_category) AS categories,
  (SELECT count(*)::integer FROM public.forum_post) AS posts,
  (SELECT count(*)::integer FROM public.forum_comment) AS comments,
  (SELECT count(*)::integer FROM public.forum_reaction) AS reactions,
  (SELECT count(*)::integer FROM public.forum_report) AS reports;
