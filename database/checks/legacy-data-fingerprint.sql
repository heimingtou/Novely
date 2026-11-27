-- READ ONLY. Aggregate fingerprints for the 16 original tables.
-- Exclude only columns added by BE02.4, so the same query works before/after.
-- No row data or individual-row hashes are returned. Keep session TimeZone=UTC.
WITH hashes AS (
  SELECT 'bookshelves' AS table_name,md5((to_jsonb(t)-ARRAY['reading_status','updated_at'])::text) AS h FROM public.bookshelves t
  UNION ALL SELECT 'chapter_contents',md5(to_jsonb(t)::text) FROM public.chapter_contents t
  UNION ALL SELECT 'chapter_likes',md5(to_jsonb(t)::text) FROM public.chapter_likes t
  UNION ALL SELECT 'chapters',md5((to_jsonb(t)-'content')::text) FROM public.chapters t
  UNION ALL SELECT 'comments',md5(to_jsonb(t)::text) FROM public.comments t
  UNION ALL SELECT 'follows',md5(to_jsonb(t)::text) FROM public.follows t
  UNION ALL SELECT 'genres',md5(to_jsonb(t)::text) FROM public.genres t
  UNION ALL SELECT 'interact_novel',md5(to_jsonb(t)::text) FROM public.interact_novel t
  UNION ALL SELECT 'interact_novel_day',md5(to_jsonb(t)::text) FROM public.interact_novel_day t
  UNION ALL SELECT 'novel_genres',md5(to_jsonb(t)::text) FROM public.novel_genres t
  UNION ALL SELECT 'novel_likes',md5(to_jsonb(t)::text) FROM public.novel_likes t
  UNION ALL SELECT 'novels',md5(to_jsonb(t)::text) FROM public.novels t
  UNION ALL SELECT 'profiles',md5(to_jsonb(t)::text) FROM public.profiles t
  UNION ALL SELECT 'reading_progress',md5((to_jsonb(t)-'scroll_position')::text) FROM public.reading_progress t
  UNION ALL SELECT 'reviews',md5((to_jsonb(t)-'updated_at')::text) FROM public.reviews t
  UNION ALL SELECT 'users',md5(to_jsonb(t)::text) FROM public.users t
), totals AS (
  SELECT table_name,count(*) AS row_count,md5(string_agg(h,'' ORDER BY h)) AS checksum
  FROM hashes GROUP BY table_name
), targets(table_name) AS (VALUES
  ('bookshelves'),('chapter_contents'),('chapter_likes'),('chapters'),('comments'),
  ('follows'),('genres'),('interact_novel'),('interact_novel_day'),('novel_genres'),
  ('novel_likes'),('novels'),('profiles'),('reading_progress'),('reviews'),('users')
)
SELECT d.table_name,COALESCE(t.row_count,0) AS row_count,
  COALESCE(t.checksum,md5('')) AS checksum
FROM targets d LEFT JOIN totals t USING(table_name) ORDER BY d.table_name;
