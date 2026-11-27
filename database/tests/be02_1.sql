-- LOCAL, empty novely_reconcile_test only. No Supabase connection or credentials.
-- Keep novely_test and its previously tested schema untouched.
-- Run with psql -X -v ON_ERROR_STOP=1 -f database/tests/be02_1.sql.
-- The schema is retained after a successful run; every fixture row is rolled back.
-- Explicit identity values prevent even sequence increments from fixture inserts.
\set ON_ERROR_STOP on
\pset pager off
\set QUIET on
\if :{?reuse_schema}
\else
\set reuse_schema false
\endif
SET client_encoding = 'UTF8';

DO $guard$
BEGIN
  IF current_database() <> 'novely_reconcile_test'
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
     OR inet_server_port() IS DISTINCT FROM 5432 THEN
    RAISE EXCEPTION 'STOP: this test may only run on 127.0.0.1:5432/novely_reconcile_test';
  END IF;
END;
$guard$;

\if :reuse_schema
-- Explicit reruns may reuse the exact, still-empty target schema; never reset it.
DO $reuse_guard$
DECLARE item record; row_count bigint;
BEGIN
  IF (SELECT array_agg(tablename::text ORDER BY tablename) FROM pg_catalog.pg_tables WHERE schemaname='public')
     IS DISTINCT FROM ARRAY['bookshelves','chapters','comments','follows','forum_category','forum_comment','forum_post','forum_reaction','forum_report','genres','interact_novel','interact_novel_day','novel_genres','novel_likes','novels','profiles','reading_progress','reviews','users'] THEN
    RAISE EXCEPTION 'STOP: reuse requires exactly the official 19 target tables';
  END IF;
  FOR item IN SELECT schemaname,tablename FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') AND schemaname NOT LIKE 'pg_temp_%' LOOP
    IF item.schemaname <> 'public' THEN RAISE EXCEPTION 'STOP: unexpected business schema'; END IF;
    EXECUTE format('SELECT count(*) FROM %I.%I',item.schemaname,item.tablename) INTO row_count;
    IF row_count <> 0 THEN RAISE EXCEPTION 'STOP: reuse requires empty business tables'; END IF;
  END LOOP;
  RAISE NOTICE 'PREFLIGHT PASS: reusing exactly 19 empty local target tables';
END;
$reuse_guard$;
\else
DO $empty_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      AND schemaname NOT LIKE 'pg_temp_%'
  ) THEN
    RAISE EXCEPTION 'STOP: novely_reconcile_test is not empty; no schema or test data was changed';
  END IF;
  RAISE NOTICE 'PREFLIGHT PASS: local novely_reconcile_test has no business tables';
END;
$empty_guard$;
\endif

SELECT current_database() AS database_name, current_user AS role_name,
       inet_server_addr() AS server_address, inet_server_port() AS server_port,
       current_setting('server_version') AS server_version;

\if :reuse_schema
\else
\ir ../schema.sql
\endif

BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE test_results (
  category text NOT NULL,
  test_name text NOT NULL,
  detail text
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.expect_error(
  category text, test_name text, statement text,
  expected_state text, expected_constraint text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $function$
DECLARE
  actual_state text;
  actual_constraint text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE,
                            actual_constraint = CONSTRAINT_NAME;
    IF actual_state <> expected_state
       OR (expected_constraint IS NOT NULL AND actual_constraint <> expected_constraint) THEN
      RAISE EXCEPTION 'FAIL [%] %: expected % / %, received % / %',
        category, test_name, expected_state, expected_constraint, actual_state, actual_constraint;
    END IF;
    INSERT INTO pg_temp.test_results VALUES (category, test_name, actual_state || ' / ' || actual_constraint);
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL [%] %: invalid operation was accepted', category, test_name;
END;
$function$;

CREATE FUNCTION pg_temp.clone_insert(table_oid oid, overrides jsonb DEFAULT '{}'::jsonb)
RETURNS text LANGUAGE plpgsql AS $function$
DECLARE column_list text; value_list text; table_name text;
BEGIN
  SELECT relname INTO table_name FROM pg_class WHERE oid=table_oid;
  SELECT string_agg(format('%I',a.attname),', ' ORDER BY a.attnum),
         string_agg(COALESCE(overrides->>a.attname,format('source.%I',a.attname)),', ' ORDER BY a.attnum)
  INTO column_list,value_list FROM pg_attribute a
  WHERE a.attrelid=table_oid AND a.attnum>0 AND NOT a.attisdropped;
  RETURN format('INSERT INTO public.%I (%s) OVERRIDING SYSTEM VALUE SELECT %s FROM public.%I source ORDER BY source.ctid LIMIT 1',
    table_name,column_list,value_list,table_name);
END;
$function$;

CREATE FUNCTION pg_temp.assert_true(test_name text, condition boolean)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  IF condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: %', test_name;
  END IF;
  INSERT INTO pg_temp.test_results VALUES ('METADATA', test_name, 'PASS');
END;
$function$;

SELECT pg_temp.assert_true('Exactly the official 19 business tables', (
  SELECT array_agg(tablename::text ORDER BY tablename) = ARRAY[
    'bookshelves', 'chapters', 'comments', 'follows', 'forum_category',
    'forum_comment', 'forum_post', 'forum_reaction', 'forum_report', 'genres',
    'interact_novel', 'interact_novel_day', 'novel_genres', 'novel_likes',
    'novels', 'profiles', 'reading_progress', 'reviews', 'users'
  ] FROM pg_catalog.pg_tables WHERE schemaname = 'public'
));

SELECT pg_temp.assert_true('No legacy chapter tables',
  to_regclass('public.chapter_contents') IS NULL AND to_regclass('public.chapter_likes') IS NULL);
SELECT pg_temp.assert_true('Chapter content is text and chapter likes counter is absent',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chapters' AND column_name = 'content' AND data_type = 'text' AND is_nullable = 'NO')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chapters' AND column_name = 'count_like'));

DO $metadata$
DECLARE
  item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES ('p', 19), ('f', 30), ('u', 11), ('c', 49)) AS counts(kind, expected)
  LOOP
    PERFORM pg_temp.assert_true('Constraint count ' || item.kind || ' = ' || item.expected,
      (SELECT count(*) = item.expected FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE n.nspname = 'public' AND c.contype::text = item.kind));
  END LOOP;
  PERFORM pg_temp.assert_true('All constraints validated', NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND NOT c.convalidated));
  PERFORM pg_temp.assert_true('Constraint names unique within each table', NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' GROUP BY c.conrelid, c.conname HAVING count(*) > 1));
END;
$metadata$;

CREATE TEMP TABLE expected_indexes (index_name text, table_name text, column_names text[]) ON COMMIT DROP;
INSERT INTO expected_indexes VALUES
  ('follows_follow_created_idx', 'follows', ARRAY['follow_id','created_at']),
  ('novels_author_updated_idx', 'novels', ARRAY['author_id','updated_at']),
  ('novels_published_latest_idx', 'novels', ARRAY['published','last_chapter_at','novel_id']),
  ('novels_published_likes_idx', 'novels', ARRAY['published','count_like','novel_id']),
  ('novel_genres_genre_novel_idx', 'novel_genres', ARRAY['genre_id','novel_id']),
  ('novel_likes_novel_created_idx', 'novel_likes', ARRAY['novel_id','created_at']),
  ('chapters_novel_status_number_idx', 'chapters', ARRAY['novel_id','status','chapter_number']),
  ('bookshelves_novel_idx', 'bookshelves', ARRAY['novel_id']),
  ('bookshelves_user_status_updated_idx', 'bookshelves', ARRAY['user_id','reading_status','updated_at']),
  ('reading_progress_novel_idx', 'reading_progress', ARRAY['novel_id']),
  ('reading_progress_chapter_novel_idx', 'reading_progress', ARRAY['chapter_id','novel_id']),
  ('reading_progress_user_last_read_idx', 'reading_progress', ARRAY['user_id','last_read_at']),
  ('comments_chapter_deleted_created_idx', 'comments', ARRAY['chapter_id','deleted_at','created_at']),
  ('comments_user_created_idx', 'comments', ARRAY['user_id','created_at']),
  ('comments_parent_chapter_idx', 'comments', ARRAY['parent_id','chapter_id']),
  ('reviews_novel_created_idx', 'reviews', ARRAY['novel_id','created_at']),
  ('forum_post_user_created_idx', 'forum_post', ARRAY['user_id','created_at']),
  ('forum_post_category_status_created_idx', 'forum_post', ARRAY['category_id','status','created_at','post_id']),
  ('forum_post_status_created_idx', 'forum_post', ARRAY['status','created_at','post_id']),
  ('forum_comment_post_created_idx', 'forum_comment', ARRAY['post_id','created_at','comment_id']),
  ('forum_comment_user_created_idx', 'forum_comment', ARRAY['user_id','created_at']),
  ('forum_comment_parent_post_idx', 'forum_comment', ARRAY['parent_id','post_id']),
  ('forum_reaction_post_type_idx', 'forum_reaction', ARRAY['post_id','reaction_type']),
  ('forum_report_user_created_idx', 'forum_report', ARRAY['user_id','created_at']),
  ('forum_report_post_created_idx', 'forum_report', ARRAY['post_id','created_at']),
  ('forum_report_status_created_idx', 'forum_report', ARRAY['status','created_at']),
  ('interact_novel_day_day_novel_idx', 'interact_novel_day', ARRAY['day','novel_id']);

DO $indexes$
DECLARE
  item record;
  actual_columns text[];
BEGIN
  PERFORM pg_temp.assert_true('57 indexes = 19 PK + 11 UNIQUE + 27 explicit',
    (SELECT count(*) = 57 FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public'));
  FOR item IN
    SELECT i.*, c.relname AS index_name FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public'
  LOOP
    PERFORM pg_temp.assert_true('Index valid and ready: ' || item.index_name, item.indisvalid AND item.indisready);
  END LOOP;
  FOR item IN SELECT * FROM pg_temp.expected_indexes LOOP
    SELECT array_agg(a.attname::text ORDER BY k.ordinality) INTO actual_columns
    FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
    CROSS JOIN LATERAL unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE n.nspname = 'public' AND c.relname = item.index_name AND t.relname = item.table_name;
    PERFORM pg_temp.assert_true('Explicit index columns: ' || item.index_name, actual_columns = item.column_names);
  END LOOP;
  FOR item IN
    SELECT c.* FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND c.contype = 'f'
  LOOP
    PERFORM pg_temp.assert_true('FK index prefix: ' || item.conname, EXISTS (
      SELECT 1 FROM pg_index i WHERE i.indrelid = item.conrelid AND i.indisvalid
      AND (SELECT array_agg(k.attnum ORDER BY k.ordinality)
           FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum, ordinality)
           WHERE k.ordinality <= cardinality(item.conkey)) = item.conkey));
  END LOOP;
END;
$indexes$;

-- Synthetic fixtures: this string is not a real password or password hash.
INSERT INTO public.users (user_id, username, email, password_hash) OVERRIDING SYSTEM VALUE VALUES
  (101, 'be02_user_one', 'one@example.invalid', 'BE02_SYNTHETIC_HASH'),
  (102, 'be02_user_two', 'two@example.invalid', 'BE02_SYNTHETIC_HASH'),
  (103, 'be02_user_three', 'three@example.invalid', 'BE02_SYNTHETIC_HASH');
INSERT INTO public.profiles (user_id, birthday, gender, phone_number, fb_link) VALUES
  (101, '2000-01-01', 'male', '+84912345678', 'https://example.invalid/one'),
  (102, '2001-01-01', 'female', '+84912345679', 'https://example.invalid/two');
INSERT INTO public.follows (follower_id, follow_id) VALUES (101,102),(102,103);
INSERT INTO public.genres (genre_id, name, slug) OVERRIDING SYSTEM VALUE VALUES (11,'Fantasy','fantasy'),(12,'Mystery','mystery');
INSERT INTO public.novels (novel_id, author_id, title, slug) OVERRIDING SYSTEM VALUE VALUES
  (1001,101,'BE02 novel one','be02-novel-one'),(1002,102,'BE02 novel two','be02-novel-two');
INSERT INTO public.novel_genres (novel_id, genre_id) VALUES (1001,11),(1002,12);
INSERT INTO public.novel_likes (user_id, novel_id) VALUES (101,1001),(102,1002);
INSERT INTO public.chapters (chapter_id, novel_id, chapter_number, title, content) OVERRIDING SYSTEM VALUE VALUES
  (2001,1001,1,'Chapter one',E'BE02 content\n\nSecond paragraph'),
  (2002,1002,1,'Other novel chapter','Other content'),(2003,1001,2,'Chapter two','Second chapter');
INSERT INTO public.bookshelves (user_id, novel_id) VALUES (101,1001),(102,1002);
INSERT INTO public.reading_progress (user_id, novel_id, chapter_id, progress_percent, scroll_position) VALUES
  (101,1001,2001,0.5,120),(102,1002,2002,0.8,300);
INSERT INTO public.comments (comment_id, user_id, chapter_id, content, parent_id) OVERRIDING SYSTEM VALUE VALUES
  (3001,101,2001,'Root one',NULL),(3002,102,2002,'Root two',NULL),(3003,102,2001,'Reply one',3001);
INSERT INTO public.reviews (review_id, user_id, novel_id, rating) OVERRIDING SYSTEM VALUE VALUES (4001,101,1001,5),(4002,102,1002,1);
INSERT INTO public.interact_novel (novel_id) VALUES (1001),(1002);
INSERT INTO public.interact_novel_day (novel_id, day) VALUES (1001,'2026-11-25'),(1002,'2026-11-26');
INSERT INTO public.forum_category (category_id,name) OVERRIDING SYSTEM VALUE VALUES (21,'Discussion'),(22,'Help');
INSERT INTO public.forum_post (post_id,user_id,category_id,title,content) OVERRIDING SYSTEM VALUE VALUES
  (5001,101,21,'BE02 post one','First post'),(5002,102,22,'BE02 post two','Second post');
INSERT INTO public.forum_comment (comment_id,post_id,user_id,parent_id,content) OVERRIDING SYSTEM VALUE VALUES
  (6001,5001,101,NULL,'Root one'),(6002,5002,102,NULL,'Root two'),(6003,5001,102,6001,'Reply one');
INSERT INTO public.forum_reaction (user_id,post_id,reaction_type) VALUES (101,5001,'like'),(102,5002,'love');
INSERT INTO public.forum_report (report_id,user_id,post_id,reason) OVERRIDING SYSTEM VALUE VALUES
  (7001,101,5001,'Synthetic report one'),(7002,102,5002,'Synthetic report two');

DO $constraints$
DECLARE
  item record;
  column_name text;
  assignment text;
  test_sql text;
  expected_name text;
  changes jsonb;
  primary_column record;
BEGIN
  -- Duplicate keys: UNIQUE keys containing a PK are also implied by that PK.
  FOR item IN
    SELECT c.*, t.relname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND c.contype IN ('p','u') ORDER BY t.relname,c.contype,c.conname
  LOOP
    changes := '{}'::jsonb;
    IF item.contype='p' THEN
      -- Isolate duplicate PKs without colliding with unrelated UNIQUE keys.
      changes := CASE item.relname
        WHEN 'users' THEN jsonb_build_object('username','source.username || ''_pkprobe''','email','''pkprobe_'' || source.email')
        WHEN 'genres' THEN jsonb_build_object('name','source.name || ''_pkprobe''','slug','source.slug || ''-pkprobe''')
        WHEN 'novels' THEN jsonb_build_object('slug','source.slug || ''-pkprobe''')
        WHEN 'chapters' THEN jsonb_build_object('novel_id','(SELECT novel_id FROM public.novels WHERE novel_id<>source.novel_id ORDER BY novel_id LIMIT 1)','chapter_number','999999')
        WHEN 'comments' THEN jsonb_build_object('chapter_id','(SELECT chapter_id FROM public.chapters WHERE chapter_id<>source.chapter_id ORDER BY chapter_id LIMIT 1)','parent_id','NULL')
        WHEN 'reviews' THEN jsonb_build_object('user_id','103')
        WHEN 'forum_category' THEN jsonb_build_object('name','source.name || ''_pkprobe''')
        WHEN 'forum_comment' THEN jsonb_build_object('post_id','(SELECT post_id FROM public.forum_post WHERE post_id<>source.post_id ORDER BY post_id LIMIT 1)','parent_id','NULL')
        ELSE changes END;
    ELSE
      -- Identity ALWAYS columns accept explicit values on INSERT with OVERRIDING,
      -- but cannot be UPDATEd. Use a fresh PK when testing a non-PK UNIQUE key.
      FOR primary_column IN
        SELECT a.attnum,a.attname FROM pg_constraint p JOIN pg_attribute a ON a.attrelid=p.conrelid AND a.attnum=ANY(p.conkey)
        WHERE p.conrelid=item.conrelid AND p.contype='p'
      LOOP
        IF NOT primary_column.attnum=ANY(item.conkey) THEN
          changes := changes || jsonb_build_object(primary_column.attname,'-20000');
        END IF;
      END LOOP;
      IF item.relname='users' AND item.conname='users_username_key' THEN changes := changes || jsonb_build_object('email','''uqprobe_'' || source.email'); END IF;
      IF item.relname='users' AND item.conname='users_email_key' THEN changes := changes || jsonb_build_object('username','source.username || ''_uqprobe'''); END IF;
      IF item.relname='genres' AND item.conname='genres_name_key' THEN changes := changes || jsonb_build_object('slug','source.slug || ''-uqprobe'''); END IF;
      IF item.relname='genres' AND item.conname='genres_slug_key' THEN changes := changes || jsonb_build_object('name','source.name || ''_uqprobe'''); END IF;
      IF item.conname='chapters_id_novel_key' THEN changes := changes || jsonb_build_object('chapter_number','999999'); END IF;
    END IF;
    test_sql := pg_temp.clone_insert(item.conrelid,changes);
    expected_name := item.conname;
    IF item.contype='u' AND EXISTS (SELECT 1 FROM pg_constraint p WHERE p.conrelid=item.conrelid AND p.contype='p' AND p.conkey <@ item.conkey) THEN
      expected_name := NULL;
    END IF;
    PERFORM pg_temp.expect_error(CASE item.contype WHEN 'p' THEN 'PRIMARY_KEY' ELSE 'UNIQUE' END,item.conname,test_sql,'23505',expected_name);
  END LOOP;

  FOR item IN
    SELECT c.*,t.relname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND c.contype='f'
  LOOP
    SELECT a.attname INTO column_name FROM pg_attribute a WHERE a.attrelid=item.conrelid AND a.attnum=item.conkey[1];
    changes := '{}'::jsonb;
    FOR primary_column IN SELECT attname FROM pg_attribute WHERE attrelid=item.conrelid AND attidentity<>'' LOOP
      changes := changes || jsonb_build_object(primary_column.attname,'-20000');
    END LOOP;
    IF item.relname='novels' THEN changes := changes || jsonb_build_object('slug','source.slug || ''-fkprobe'''); END IF;
    IF item.conname='fk_reading_progress_chapter' THEN changes := changes || jsonb_build_object('user_id','103'); END IF;
    IF item.conname='fk_reading_progress_novel' THEN changes := changes || jsonb_build_object('chapter_id','NULL'); END IF;
    IF item.conname='fk_comments_chapter' OR item.conname='fk_forum_comment_post' THEN changes := changes || jsonb_build_object('parent_id','NULL'); END IF;
    changes := changes || jsonb_build_object(column_name,'-30000');
    test_sql := pg_temp.clone_insert(item.conrelid,changes);
    PERFORM pg_temp.expect_error('FOREIGN_KEY',item.conname,test_sql,'23503',item.conname);
  END LOOP;

  FOR item IN
    SELECT c.*,t.relname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND c.contype='c'
  LOOP
    SELECT a.attname INTO column_name FROM pg_attribute a WHERE a.attrelid=item.conrelid AND a.attnum=item.conkey[1];
    assignment := CASE
      WHEN item.conname='chapters_published_at_check' THEN 'status = ''published'', published_at = NULL'
      WHEN item.conname='follows_no_self_check' THEN 'follower_id = follow_id'
      WHEN item.conname IN ('comments_no_self_parent_check','forum_comment_no_self_parent_check') THEN 'parent_id = comment_id'
      WHEN column_name='level' THEN 'level = 0'
      WHEN column_name='username' THEN 'username = ''ab'''
      WHEN column_name='email' THEN 'email = ''invalid-email'''
      WHEN column_name='birthday' THEN 'birthday = DATE ''1899-12-31'''
      WHEN column_name='phone_number' THEN 'phone_number = ''abc'''
      WHEN column_name='fb_link' THEN 'fb_link = ''http://example.invalid'''
      WHEN column_name IN ('role','gender','status','reading_status','reaction_type') THEN format('%I = ''invalid_value''',column_name)
      WHEN column_name IN ('name','title','content','reason') THEN format('%I = ''   ''',column_name)
      WHEN column_name='slug' THEN 'slug = ''invalid slug'''
      WHEN column_name IN ('chapter_number','rating') THEN format('%I = 0',column_name)
      WHEN column_name IN ('progress_percent','scroll_position','word_count','view','under_eighteen','eighteen_to_thirty_five','over_thirty_five','age_unknown','male','female','gender_other')
        OR column_name LIKE 'count_%' THEN format('%I = -1',column_name)
      ELSE NULL END;
    IF assignment IS NULL THEN RAISE EXCEPTION 'No negative test for CHECK %',item.conname; END IF;
    test_sql := format('UPDATE public.%I SET %s WHERE ctid=(SELECT ctid FROM public.%I ORDER BY ctid LIMIT 1)',item.relname,assignment,item.relname);
    PERFORM pg_temp.expect_error('CHECK',item.conname,test_sql,'23514',item.conname);
  END LOOP;

  FOR item IN
    SELECT t.oid AS table_oid,t.relname,a.attname FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relkind='r' AND a.attnum>0 AND NOT a.attisdropped AND a.attnotnull
  LOOP
    test_sql := pg_temp.clone_insert(item.table_oid,jsonb_build_object(item.attname,'NULL'));
    PERFORM pg_temp.expect_error('NOT_NULL',item.relname || '.' || item.attname,test_sql,'23502');
  END LOOP;
END;
$constraints$;

-- Cross-record integrity tests use valid but mismatched existing identifiers.
SELECT pg_temp.expect_error('INTEGRITY','Progress cannot use another novels chapter',
  'UPDATE public.reading_progress SET chapter_id=2002 WHERE user_id=101 AND novel_id=1001','23503','fk_reading_progress_chapter');
SELECT pg_temp.expect_error('INTEGRITY','Chapter reply cannot use another chapters parent',
  'UPDATE public.comments SET parent_id=3002 WHERE comment_id=3003','23503','fk_comments_parent');
SELECT pg_temp.expect_error('INTEGRITY','Forum reply cannot use another posts parent',
  'UPDATE public.forum_comment SET parent_id=6002 WHERE comment_id=6003','23503','fk_forum_comment_parent');
SELECT pg_temp.expect_error('INTEGRITY','Referenced user cannot be removed implicitly',
  'DELETE FROM public.users WHERE user_id=101','23001','fk_novels_author');
SELECT pg_temp.expect_error('INTEGRITY','Progress cannot exceed 100 percent',
  'UPDATE public.reading_progress SET progress_percent=1.01 WHERE user_id=101','23514','reading_progress_progress_percent_check');
SELECT pg_temp.expect_error('INTEGRITY','Review cannot exceed five stars',
  'UPDATE public.reviews SET rating=6 WHERE review_id=4001','23514','reviews_rating_check');
SELECT pg_temp.expect_error('INTEGRITY','Forum title cannot exceed 150 characters',
  'UPDATE public.forum_post SET title=repeat(''x'',151) WHERE post_id=5001','23514','forum_post_title_check');
SELECT pg_temp.expect_error('INTEGRITY','Forum post cannot exceed 5000 characters',
  'UPDATE public.forum_post SET content=repeat(''x'',5001) WHERE post_id=5001','23514','forum_post_content_check');
SELECT pg_temp.expect_error('INTEGRITY','Forum comment cannot exceed 2000 characters',
  'UPDATE public.forum_comment SET content=repeat(''x'',2001) WHERE comment_id=6001','23514','forum_comment_content_check');
SELECT pg_temp.expect_error('INTEGRITY','Forum report cannot exceed 2000 characters',
  'UPDATE public.forum_report SET reason=repeat(''x'',2001) WHERE report_id=7001','23514','forum_report_reason_check');

SELECT pg_temp.assert_true('A user may have no profile',NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=103));
SELECT pg_temp.assert_true('Different novels may both have chapter one',(SELECT count(*)=2 FROM public.chapters WHERE chapter_number=1));
SELECT pg_temp.assert_true('Chapter text and paragraph breaks are preserved',(SELECT content=E'BE02 content\n\nSecond paragraph' FROM public.chapters WHERE chapter_id=2001));
SELECT pg_temp.assert_true('Bookshelf defaults are usable',(SELECT bool_and(reading_status='plan_to_read' AND saved_at IS NOT NULL AND updated_at IS NOT NULL) FROM public.bookshelves));

DO $valid_values$
DECLARE value text;
BEGIN
  FOREACH value IN ARRAY ARRAY['plan_to_read','reading','completed','dropped'] LOOP
    UPDATE public.bookshelves SET reading_status=value,updated_at=now() WHERE user_id=101 AND novel_id=1001;
    INSERT INTO pg_temp.test_results VALUES ('VALID_DATA','Library status ' || value,'PASS');
  END LOOP;
  FOREACH value IN ARRAY ARRAY['published','hidden','deleted'] LOOP
    UPDATE public.forum_post SET status=value WHERE post_id=5001;
    INSERT INTO pg_temp.test_results VALUES ('VALID_DATA','Forum post status ' || value,'PASS');
  END LOOP;
  FOREACH value IN ARRAY ARRAY['like','love','wow'] LOOP
    UPDATE public.forum_reaction SET reaction_type=value WHERE user_id=101 AND post_id=5001;
    INSERT INTO pg_temp.test_results VALUES ('VALID_DATA','Forum reaction ' || value,'PASS');
  END LOOP;
  FOREACH value IN ARRAY ARRAY['pending','resolved','dismissed'] LOOP
    UPDATE public.forum_report SET status=value WHERE report_id=7001;
    INSERT INTO pg_temp.test_results VALUES ('VALID_DATA','Forum report status ' || value,'PASS');
  END LOOP;
END;
$valid_values$;

UPDATE public.reading_progress SET chapter_id=NULL,progress_percent=0,scroll_position=0 WHERE user_id=101;
SELECT pg_temp.assert_true('Progress accepts a null chapter and zero boundaries',(SELECT chapter_id IS NULL AND progress_percent=0 AND scroll_position=0 FROM public.reading_progress WHERE user_id=101));
UPDATE public.reading_progress SET chapter_id=2003,progress_percent=1,scroll_position=2147483647 WHERE user_id=101;
SELECT pg_temp.assert_true('Progress accepts another chapter of the same novel and completion',(SELECT chapter_id=2003 AND progress_percent=1 FROM public.reading_progress WHERE user_id=101));
UPDATE public.profiles SET birthday=NULL,gender=NULL,phone_number=NULL,fb_link=NULL WHERE user_id=101;
SELECT pg_temp.assert_true('Profile optional attributes accept null',(SELECT birthday IS NULL AND gender IS NULL AND phone_number IS NULL AND fb_link IS NULL FROM public.profiles WHERE user_id=101));

\ir reconciliation.sql

DO $coverage$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES ('PRIMARY_KEY',19),('UNIQUE',11),('FOREIGN_KEY',30),('CHECK',49)) counts(category,expected)
  LOOP
    PERFORM pg_temp.assert_true('Full constraint test coverage: ' || item.category,
      (SELECT count(*)=item.expected FROM pg_temp.test_results r WHERE r.category=item.category));
  END LOOP;
  PERFORM pg_temp.assert_true('All identity sequences remain untouched', NOT EXISTS (
    SELECT 1 FROM pg_sequences WHERE schemaname='public' AND last_value IS NOT NULL));
END;
$coverage$;

\echo BE02.1 TEST SUMMARY (all rows below are successful assertions)
SELECT category,count(*) AS passed FROM pg_temp.test_results GROUP BY category ORDER BY category;
SELECT count(*) AS total_passed FROM pg_temp.test_results;
SELECT test_name,detail FROM pg_temp.test_results WHERE category IN ('PRIMARY_KEY','UNIQUE','FOREIGN_KEY','CHECK','INTEGRITY') ORDER BY category,test_name;
ROLLBACK;

DO $cleanup$
DECLARE item record; row_count bigint;
BEGIN
  FOR item IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',item.tablename) INTO row_count;
    IF row_count<>0 THEN RAISE EXCEPTION 'Fixture rows remain in %',item.tablename; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public')<>19 THEN
    RAISE EXCEPTION 'Expected 19 business tables after rollback';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname='public' AND last_value IS NOT NULL) THEN
    RAISE EXCEPTION 'Fixture inserts changed identity sequence state';
  END IF;
  RAISE NOTICE 'CLEANUP PASS: exactly 19 business tables, zero fixture rows, identity sequences untouched';
END;
$cleanup$;
SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename;
\echo BE02.1 RESULT: PASS
