-- Included by be02_1.sql inside its fixture transaction. Never run standalone.
-- Each successful behavior case rolls back to the original fixtures, allowing
-- destructive CASCADE tests without recreating tables or advancing identities.
CREATE FUNCTION pg_temp.run_case(category text, test_name text, body text)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  BEGIN
    EXECUTE 'DO $case_body$ ' || body || ' $case_body$';
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'rollback successful case';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN
    NULL;
  END;
  INSERT INTO pg_temp.test_results VALUES (category, test_name, 'PASS; case rolled back');
END;
$function$;

CREATE FUNCTION pg_temp.assert_counters()
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  PERFORM pg_temp.assert_true('Active chapter comment counters match rows', NOT EXISTS (
    SELECT 1 FROM public.chapters c WHERE c.count_comment <>
      (SELECT count(*) FROM public.comments x WHERE x.chapter_id=c.chapter_id AND x.deleted_at IS NULL)));
  PERFORM pg_temp.assert_true('Follow counters match rows', NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.count_following <>
      (SELECT count(*) FROM public.follows f WHERE f.follower_id=u.user_id)
      OR u.count_follower <> (SELECT count(*) FROM public.follows f WHERE f.follow_id=u.user_id)));
  PERFORM pg_temp.assert_true('Novel like counters match rows', NOT EXISTS (
    SELECT 1 FROM public.novels n WHERE n.count_like <>
      (SELECT count(*) FROM public.novel_likes l WHERE l.novel_id=n.novel_id)));
END;
$function$;

SELECT pg_temp.assert_counters();

DO $referential_metadata$
DECLARE item record; expected_action "char";
BEGIN
  FOR item IN
    SELECT c.*, t.relname FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND c.contype='f'
  LOOP
    expected_action := CASE
      WHEN item.relname LIKE 'forum_%' THEN 'a'
      WHEN item.conname IN ('fk_novels_author','fk_novel_genres_genre') THEN 'r'
      WHEN item.conname='fk_reading_progress_chapter' THEN 'n'
      ELSE 'c' END;
    PERFORM pg_temp.assert_true('Delete action: ' || item.conname,
      item.confdeltype=expected_action AND item.confupdtype='a');
  END LOOP;
  PERFORM pg_temp.assert_true('Composite SET NULL affects chapter_id only', (
    SELECT c.confdelsetcols=ARRAY[a.attnum]::smallint[] FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attname='chapter_id'
    WHERE c.conrelid='public.reading_progress'::regclass AND c.conname='fk_reading_progress_chapter'));
END;
$referential_metadata$;

DO $trigger_metadata$
DECLARE item record; expected_function text; expected_type integer; actual_columns text[];
BEGIN
  PERFORM pg_temp.assert_true('Exactly 11 application triggers', (
    SELECT count(*)=11 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal));
  PERFORM pg_temp.assert_true('Exactly four application trigger functions', (
    SELECT array_agg(p.proname::text ORDER BY p.proname) =
      ARRAY['set_updated_at','update_comments_count','update_follows_count','update_novel_likes_count']
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prorettype='trigger'::regtype));
  PERFORM pg_temp.assert_true('Trigger functions are invoker with a fixed search_path', NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prorettype='trigger'::regtype
      AND (p.prosecdef OR NOT COALESCE(p.proconfig @> ARRAY['search_path=pg_catalog'],false))));
  FOR item IN
    SELECT t.*, c.relname, p.proname FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
    WHERE n.nspname='public' AND NOT t.tgisinternal
  LOOP
    expected_function := CASE item.tgname
      WHEN 'trg_comments_count' THEN 'update_comments_count'
      WHEN 'trg_follows_count' THEN 'update_follows_count'
      WHEN 'trg_novel_likes_count' THEN 'update_novel_likes_count'
      ELSE 'set_updated_at' END;
    -- 1=ROW, 2=BEFORE, 4=INSERT, 8=DELETE, 16=UPDATE.
    expected_type := CASE WHEN expected_function='set_updated_at' THEN 19 ELSE 29 END;
    PERFORM pg_temp.assert_true('Trigger binding/events/enabled: ' || item.tgname,
      item.proname=expected_function AND item.tgtype=expected_type AND item.tgenabled='O'
      AND item.tgname=CASE WHEN expected_function='set_updated_at'
        THEN 'trg_' || item.relname || '_updated_at' ELSE 'trg_' || item.relname || '_count' END);
    SELECT COALESCE(array_agg(a.attname::text ORDER BY a.attname),ARRAY[]::text[]) INTO actual_columns
    FROM unnest(item.tgattr::smallint[]) k(attnum)
    JOIN pg_catalog.pg_attribute a ON a.attrelid=item.tgrelid AND a.attnum=k.attnum;
    PERFORM pg_temp.assert_true('Trigger update columns: ' || item.tgname,
      actual_columns=CASE item.tgname
        WHEN 'trg_comments_count' THEN ARRAY['chapter_id','deleted_at']
        WHEN 'trg_follows_count' THEN ARRAY['follow_id','follower_id']
        WHEN 'trg_novel_likes_count' THEN ARRAY['novel_id','user_id']
        ELSE ARRAY[]::text[] END);
  END LOOP;
  PERFORM pg_temp.assert_true('All eight timestamp tables are covered', (
    SELECT array_agg(c.relname::text ORDER BY c.relname)=
      ARRAY['bookshelves','chapters','comments','forum_comment','forum_post','novels','reviews','users']
    FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
    WHERE NOT t.tgisinternal AND p.oid='public.set_updated_at()'::regprocedure));
END;
$trigger_metadata$;

SELECT pg_temp.assert_true('No exact duplicate indexes', NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indrelid
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
  GROUP BY i.indrelid,i.indkey,i.indclass,i.indcollation,i.indoption,
           i.indexprs::text,i.indpred::text HAVING count(*)>1));

SELECT pg_temp.run_case('COMMENT_TRIGGER','Active insert increments; hard delete decrements',$case$
BEGIN
  INSERT INTO public.comments(comment_id,user_id,chapter_id,content) OVERRIDING SYSTEM VALUE
    VALUES(8001,103,2001,'Synthetic new comment');
  PERFORM pg_temp.assert_true('Active insertion counted', (SELECT count_comment=3 FROM public.chapters WHERE chapter_id=2001));
  PERFORM pg_temp.assert_counters();
  DELETE FROM public.comments WHERE comment_id=8001;
  PERFORM pg_temp.assert_true('Hard deletion counted', (SELECT count_comment=2 FROM public.chapters WHERE chapter_id=2001));
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('COMMENT_TRIGGER','Hidden insert and hard delete do not affect count',$case$
BEGIN
  INSERT INTO public.comments(comment_id,user_id,chapter_id,content,deleted_at) OVERRIDING SYSTEM VALUE
    VALUES(8001,103,2001,'Initially hidden',now());
  PERFORM pg_temp.assert_counters();
  DELETE FROM public.comments WHERE comment_id=8001;
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('COMMENT_TRIGGER','Soft delete and restore count only active rows',$case$
BEGIN
  UPDATE public.comments SET deleted_at=now() WHERE comment_id=3001;
  PERFORM pg_temp.assert_true('Root soft deletion retains reply', EXISTS(SELECT 1 FROM public.comments WHERE comment_id=3003));
  PERFORM pg_temp.assert_true('Only active reply remains counted', (SELECT count_comment=1 FROM public.chapters WHERE chapter_id=2001));
  PERFORM pg_temp.assert_counters();
  UPDATE public.comments SET deleted_at=now() WHERE comment_id=3001;
  PERFORM pg_temp.assert_counters();
  UPDATE public.comments SET deleted_at=NULL WHERE comment_id=3001;
  PERFORM pg_temp.assert_true('Restored root counted', (SELECT count_comment=2 FROM public.chapters WHERE chapter_id=2001));
  PERFORM pg_temp.assert_counters();
  UPDATE public.comments SET deleted_at=NULL,chapter_id=chapter_id,content='Changed active root' WHERE comment_id=3001;
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('COMMENT_TRIGGER','Move active and hidden comments between chapters',$case$
BEGIN
  INSERT INTO public.comments(comment_id,user_id,chapter_id,content) OVERRIDING SYSTEM VALUE
    VALUES(8001,103,2001,'Movable root');
  UPDATE public.comments SET chapter_id=2002 WHERE comment_id=8001;
  PERFORM pg_temp.assert_true('Move decrements source and increments destination',
    (SELECT count_comment=2 FROM public.chapters WHERE chapter_id=2001)
    AND (SELECT count_comment=2 FROM public.chapters WHERE chapter_id=2002));
  PERFORM pg_temp.assert_counters();
  UPDATE public.comments SET chapter_id=2003,deleted_at=now() WHERE comment_id=8001;
  PERFORM pg_temp.assert_counters();
  UPDATE public.comments SET chapter_id=2001 WHERE comment_id=8001;
  PERFORM pg_temp.assert_counters();
  UPDATE public.comments SET chapter_id=2002,deleted_at=NULL WHERE comment_id=8001;
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('COMMENT_TRIGGER','Bulk soft delete and restore maintain counters',$case$
BEGIN
  UPDATE public.comments SET deleted_at=now();
  PERFORM pg_temp.assert_true('All chapter counters become zero', (SELECT bool_and(count_comment=0) FROM public.chapters));
  PERFORM pg_temp.assert_counters();
  UPDATE public.comments SET deleted_at=NULL;
  PERFORM pg_temp.assert_counters();
  DELETE FROM public.comments;
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('FOLLOW_TRIGGER','Insert and delete update both follow counters',$case$
BEGIN
  INSERT INTO public.follows(follower_id,follow_id) VALUES(103,101);
  PERFORM pg_temp.assert_true('New follower counted on both users',
    (SELECT count_following=1 FROM public.users WHERE user_id=103)
    AND (SELECT count_follower=1 FROM public.users WHERE user_id=101));
  PERFORM pg_temp.assert_counters();
  DELETE FROM public.follows WHERE follower_id=103 AND follow_id=101;
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('FOLLOW_TRIGGER','Updates move followed user and follower independently',$case$
BEGIN
  INSERT INTO public.follows(follower_id,follow_id) VALUES(103,101);
  UPDATE public.follows SET follow_id=102 WHERE follower_id=103 AND follow_id=101;
  PERFORM pg_temp.assert_counters();
  UPDATE public.follows SET follower_id=101,follow_id=103 WHERE follower_id=103 AND follow_id=102;
  PERFORM pg_temp.assert_counters();
  UPDATE public.follows SET follower_id=follower_id,follow_id=follow_id;
  PERFORM pg_temp.assert_counters();
  DELETE FROM public.follows;
  PERFORM pg_temp.assert_true('Bulk delete clears both counters',
    (SELECT bool_and(count_following=0 AND count_follower=0) FROM public.users));
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('LIKE_TRIGGER','Insert and delete update novel likes',$case$
BEGIN
  INSERT INTO public.novel_likes(user_id,novel_id) VALUES(103,1001);
  PERFORM pg_temp.assert_true('New like counted', (SELECT count_like=2 FROM public.novels WHERE novel_id=1001));
  PERFORM pg_temp.assert_counters();
  DELETE FROM public.novel_likes WHERE user_id=103 AND novel_id=1001;
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('LIKE_TRIGGER','Move novel and change liker without double counting',$case$
BEGIN
  INSERT INTO public.novel_likes(user_id,novel_id) VALUES(103,1001);
  UPDATE public.novel_likes SET novel_id=1002 WHERE user_id=103 AND novel_id=1001;
  PERFORM pg_temp.assert_counters();
  UPDATE public.novel_likes SET novel_id=1001,user_id=102 WHERE user_id=103 AND novel_id=1002;
  PERFORM pg_temp.assert_counters();
  UPDATE public.novel_likes SET user_id=user_id,novel_id=novel_id;
  PERFORM pg_temp.assert_counters();
  DELETE FROM public.novel_likes;
  PERFORM pg_temp.assert_true('All novel like counters become zero', (SELECT bool_and(count_like=0) FROM public.novels));
  PERFORM pg_temp.assert_counters();
END;
$case$);

DO $timestamp_cases$
DECLARE item record; body text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('users','user_id=101'),('novels','novel_id=1001'),('chapters','chapter_id=2001'),
    ('comments','comment_id=3001'),('bookshelves','user_id=101 AND novel_id=1001'),
    ('reviews','review_id=4001'),('forum_post','post_id=5001'),('forum_comment','comment_id=6001')
  ) x(table_name,predicate)
  LOOP
    -- now() is constant for the surrounding transaction. Setting a stale value
    -- tests the trigger without sleeps or unreliable clock comparisons.
    body := format('BEGIN UPDATE public.%I SET updated_at=''2000-01-01 00:00:00+00'' WHERE %s;
      PERFORM pg_temp.assert_true(''updated_at is transaction now'',
        (SELECT updated_at=pg_catalog.now() FROM public.%I WHERE %s)); END;',
      item.table_name,item.predicate,item.table_name,item.predicate);
    PERFORM pg_temp.run_case('TIMESTAMP_TRIGGER',item.table_name || ' updated_at',body);
  END LOOP;
END;
$timestamp_cases$;

SELECT pg_temp.run_case('TIMESTAMP_TRIGGER','Merged chapter content uses timestamp; word count stays service-owned',$case$
BEGIN
  INSERT INTO public.chapters(chapter_id,novel_id,chapter_number,title,content,word_count,updated_at)
    OVERRIDING SYSTEM VALUE VALUES(8001,1001,99,'New chapter','Original text',2,'2000-01-01 00:00:00+00');
  UPDATE public.chapters SET content=E'Changed text\n\nWith paragraph' WHERE chapter_id=8001;
  PERFORM pg_temp.assert_true('Content update touches timestamp and preserves service word count', (
    SELECT content=E'Changed text\n\nWith paragraph' AND updated_at=now() AND word_count=2
    FROM public.chapters WHERE chapter_id=8001));
END;
$case$);

SELECT pg_temp.run_case('VALID_DATA','Published chapter requires timestamp; draft accepts null',$case$
BEGIN
  UPDATE public.chapters SET status='published',published_at=now() WHERE chapter_id=2001;
  PERFORM pg_temp.assert_true('Published chapter timestamp retained',
    (SELECT status='published' AND published_at IS NOT NULL FROM public.chapters WHERE chapter_id=2001));
  UPDATE public.chapters SET status='draft',published_at=NULL WHERE chapter_id=2001;
  PERFORM pg_temp.assert_true('Draft may omit timestamp',
    (SELECT status='draft' AND published_at IS NULL FROM public.chapters WHERE chapter_id=2001));
END;
$case$);
SELECT pg_temp.expect_error('INTEGRITY','Published chapter cannot lose timestamp',
  'UPDATE public.chapters SET status=''published'',published_at=NULL WHERE chapter_id=2001',
  '23514','chapters_published_at_check');

SELECT pg_temp.run_case('ON_DELETE','Chapter deletion nulls chapter_id and preserves progress',$case$
BEGIN
  UPDATE public.reading_progress SET chapter_id=2001,progress_percent=0.5,scroll_position=120 WHERE user_id=101 AND novel_id=1001;
  DELETE FROM public.chapters WHERE chapter_id=2001;
  PERFORM pg_temp.assert_true('Progress keeps its novel and pixel offset', EXISTS (
    SELECT 1 FROM public.reading_progress WHERE user_id=101 AND novel_id=1001
      AND chapter_id IS NULL AND progress_percent=0.5 AND scroll_position=120));
  PERFORM pg_temp.assert_true('Chapter comments and replies cascade', NOT EXISTS (
    SELECT 1 FROM public.comments WHERE chapter_id=2001));
  PERFORM pg_temp.assert_true('Novel and library survive chapter deletion',
    EXISTS(SELECT 1 FROM public.novels WHERE novel_id=1001)
    AND EXISTS(SELECT 1 FROM public.bookshelves WHERE user_id=101 AND novel_id=1001));
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('ON_DELETE','Deleting a root comment cascades replies and decrements count',$case$
BEGIN
  DELETE FROM public.comments WHERE comment_id=3001;
  PERFORM pg_temp.assert_true('Root and reply removed', NOT EXISTS (
    SELECT 1 FROM public.comments WHERE comment_id IN(3001,3003)));
  PERFORM pg_temp.assert_true('Cascade decrements both active comments', (SELECT count_comment=0 FROM public.chapters WHERE chapter_id=2001));
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('ON_DELETE','Hidden parent deletion removes active reply without underflow',$case$
BEGIN
  UPDATE public.comments SET deleted_at=now() WHERE comment_id=3001;
  DELETE FROM public.comments WHERE comment_id=3001;
  PERFORM pg_temp.assert_true('Hidden root and active reply removed', NOT EXISTS (
    SELECT 1 FROM public.comments WHERE comment_id IN(3001,3003)));
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('ON_DELETE','Novel deletion cascades all owned reading data',$case$
BEGIN
  DELETE FROM public.novels WHERE novel_id=1001;
  PERFORM pg_temp.assert_true('Novel and chapters removed',
    NOT EXISTS(SELECT 1 FROM public.novels WHERE novel_id=1001)
    AND NOT EXISTS(SELECT 1 FROM public.chapters WHERE novel_id=1001));
  PERFORM pg_temp.assert_true('Novel dependents removed',
    NOT EXISTS(SELECT 1 FROM public.novel_genres WHERE novel_id=1001)
    AND NOT EXISTS(SELECT 1 FROM public.novel_likes WHERE novel_id=1001)
    AND NOT EXISTS(SELECT 1 FROM public.bookshelves WHERE novel_id=1001)
    AND NOT EXISTS(SELECT 1 FROM public.reading_progress WHERE novel_id=1001)
    AND NOT EXISTS(SELECT 1 FROM public.reviews WHERE novel_id=1001)
    AND NOT EXISTS(SELECT 1 FROM public.interact_novel WHERE novel_id=1001)
    AND NOT EXISTS(SELECT 1 FROM public.interact_novel_day WHERE novel_id=1001)
    AND NOT EXISTS(SELECT 1 FROM public.comments WHERE chapter_id IN(2001,2003)));
  PERFORM pg_temp.assert_true('Independent users, genres and forum remain',
    EXISTS(SELECT 1 FROM public.users WHERE user_id=101)
    AND EXISTS(SELECT 1 FROM public.genres WHERE genre_id=11)
    AND EXISTS(SELECT 1 FROM public.forum_post WHERE post_id=5001));
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.run_case('ON_DELETE','User deletion cascades profile, library, reading and social rows',$case$
BEGIN
  INSERT INTO public.users(user_id,username,email,password_hash) OVERRIDING SYSTEM VALUE
    VALUES(104,'test-cascade-user','cascade@example.invalid','BE02_SYNTHETIC_HASH');
  INSERT INTO public.profiles(user_id) VALUES(104);
  INSERT INTO public.follows(follower_id,follow_id) VALUES(104,101),(102,104);
  INSERT INTO public.novel_likes(user_id,novel_id) VALUES(104,1001);
  INSERT INTO public.bookshelves(user_id,novel_id) VALUES(104,1001);
  INSERT INTO public.reading_progress(user_id,novel_id,chapter_id) VALUES(104,1001,2001);
  INSERT INTO public.reviews(review_id,user_id,novel_id,rating) OVERRIDING SYSTEM VALUE VALUES(8001,104,1001,4);
  INSERT INTO public.comments(comment_id,user_id,chapter_id,content,parent_id) OVERRIDING SYSTEM VALUE
    VALUES(8001,104,2001,'User root',NULL),(8002,103,2001,'Other user reply',8001);
  PERFORM pg_temp.assert_counters();
  DELETE FROM public.users WHERE user_id=104;
  PERFORM pg_temp.assert_true('All direct user dependents removed',
    NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=104)
    AND NOT EXISTS(SELECT 1 FROM public.follows WHERE follower_id=104 OR follow_id=104)
    AND NOT EXISTS(SELECT 1 FROM public.novel_likes WHERE user_id=104)
    AND NOT EXISTS(SELECT 1 FROM public.bookshelves WHERE user_id=104)
    AND NOT EXISTS(SELECT 1 FROM public.reading_progress WHERE user_id=104)
    AND NOT EXISTS(SELECT 1 FROM public.reviews WHERE user_id=104)
    AND NOT EXISTS(SELECT 1 FROM public.comments WHERE comment_id IN(8001,8002)));
  PERFORM pg_temp.assert_true('Unrelated author and reading rows remain',
    EXISTS(SELECT 1 FROM public.novels WHERE novel_id=1001)
    AND EXISTS(SELECT 1 FROM public.users WHERE user_id=103));
  PERFORM pg_temp.assert_counters();
END;
$case$);

SELECT pg_temp.expect_error('ON_DELETE','Author deletion is RESTRICT',
  'DELETE FROM public.users WHERE user_id=101','23001','fk_novels_author');
SELECT pg_temp.expect_error('ON_DELETE','Used genre deletion is RESTRICT',
  'DELETE FROM public.genres WHERE genre_id=11','23001','fk_novel_genres_genre');
SELECT pg_temp.expect_error('ON_DELETE','Forum category NO ACTION',
  'DELETE FROM public.forum_category WHERE category_id=21','23503','fk_forum_post_category');
SELECT pg_temp.expect_error('ON_DELETE','Forum post with dependents cannot be deleted',
  'DELETE FROM public.forum_post WHERE post_id=5001','23503');
SELECT pg_temp.expect_error('ON_DELETE','Forum parent with replies cannot be deleted',
  'DELETE FROM public.forum_comment WHERE comment_id=6001','23503','fk_forum_comment_parent');

-- Isolate each remaining Forum NO ACTION FK from unrelated user/post FKs.
DO $forum_delete_cases$
DECLARE item record; body text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('forum_post','fk_forum_post_user',
      'INSERT INTO public.forum_post(post_id,user_id,category_id,title,content) OVERRIDING SYSTEM VALUE VALUES(8001,104,21,''New post'',''New content'')'),
    ('forum_comment','fk_forum_comment_user',
      'INSERT INTO public.forum_comment(comment_id,user_id,post_id,content) OVERRIDING SYSTEM VALUE VALUES(8001,104,5001,''New comment'')'),
    ('forum_reaction','fk_forum_reaction_user',
      'INSERT INTO public.forum_reaction(user_id,post_id) VALUES(104,5001)'),
    ('forum_report','fk_forum_report_user',
      'INSERT INTO public.forum_report(report_id,user_id,post_id,reason) OVERRIDING SYSTEM VALUE VALUES(8001,104,5001,''Synthetic reason'')')
  ) x(table_name,constraint_name,insert_sql)
  LOOP
    body := format('BEGIN
      INSERT INTO public.users(user_id,username,email,password_hash) OVERRIDING SYSTEM VALUE
        VALUES(104,''test-forum-user'',''forum@example.invalid'',''BE02_SYNTHETIC_HASH'');
      %s;
      PERFORM pg_temp.expect_error(''ON_DELETE'',''isolated forum user delete'',
        ''DELETE FROM public.users WHERE user_id=104'',''23503'',%L);
      PERFORM pg_temp.assert_true(''Forum user retained'',EXISTS(SELECT 1 FROM public.users WHERE user_id=104));
      END;',item.insert_sql,item.constraint_name);
    PERFORM pg_temp.run_case('ON_DELETE',item.constraint_name || ' NO ACTION',body);
  END LOOP;
  FOR item IN SELECT * FROM (VALUES
    ('fk_forum_comment_post',
      'INSERT INTO public.forum_comment(comment_id,user_id,post_id,content) OVERRIDING SYSTEM VALUE VALUES(8001,103,8001,''New comment'')'),
    ('fk_forum_reaction_post',
      'INSERT INTO public.forum_reaction(user_id,post_id) VALUES(103,8001)'),
    ('fk_forum_report_post',
      'INSERT INTO public.forum_report(report_id,user_id,post_id,reason) OVERRIDING SYSTEM VALUE VALUES(8001,103,8001,''Synthetic reason'')')
  ) x(constraint_name,insert_sql)
  LOOP
    body := format('BEGIN
      INSERT INTO public.forum_post(post_id,user_id,category_id,title,content) OVERRIDING SYSTEM VALUE
        VALUES(8001,103,21,''Isolated post'',''Isolated content'');
      %s;
      PERFORM pg_temp.expect_error(''ON_DELETE'',''isolated forum post delete'',
        ''DELETE FROM public.forum_post WHERE post_id=8001'',''23503'',%L);
      END;',item.insert_sql,item.constraint_name);
    PERFORM pg_temp.run_case('ON_DELETE',item.constraint_name || ' NO ACTION',body);
  END LOOP;
END;
$forum_delete_cases$;

SELECT pg_temp.run_case('TRIGGER_SAFETY','Counter triggers work without public in caller search_path',$case$
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_temp,pg_catalog',true);
  INSERT INTO public.comments(comment_id,user_id,chapter_id,content) OVERRIDING SYSTEM VALUE VALUES(8001,103,2001,'Path independent');
  INSERT INTO public.follows(follower_id,follow_id) VALUES(103,101);
  INSERT INTO public.novel_likes(user_id,novel_id) VALUES(103,1001);
  PERFORM pg_temp.assert_counters();
  DELETE FROM public.comments WHERE comment_id=8001;
  DELETE FROM public.follows WHERE follower_id=103 AND follow_id=101;
  DELETE FROM public.novel_likes WHERE user_id=103 AND novel_id=1001;
  PERFORM pg_temp.assert_counters();
END;
$case$);

-- Every behavior case must leave the original valid fixture counters intact.
SELECT pg_temp.assert_counters();

\echo RECONCILIATION OBJECT COUNTS (application triggers exclude internal FK triggers)
SELECT
  (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public') AS business_tables,
  (SELECT count(*) FROM pg_catalog.pg_indexes WHERE schemaname='public') AS indexes,
  (SELECT count(*) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal) AS application_triggers,
  (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prorettype='trigger'::regtype) AS trigger_functions;
