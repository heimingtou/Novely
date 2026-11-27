-- Test inside a caller-owned SAVEPOINT, then ROLLBACK TO it. Synthetic data only.
-- No identity nextval, real row values, public policies or schema changes here.
DO $compat$
DECLARE observed integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE user_id=-240101)
    OR EXISTS (SELECT 1 FROM public.novels WHERE novel_id=-240201)
    OR EXISTS (SELECT 1 FROM public.chapters WHERE chapter_id IN (-240301,-240302)) THEN
    RAISE EXCEPTION 'BE02.4: reserved synthetic IDs are occupied';
  END IF;
  INSERT INTO public.users(user_id,username,email,password_hash) OVERRIDING SYSTEM VALUE
    VALUES(-240101,'be024_sql_fixture','be024-sql@example.invalid','BE024_SYNTHETIC_HASH_ONLY');
  INSERT INTO public.novels(novel_id,author_id,title,slug) OVERRIDING SYSTEM VALUE
    VALUES(-240201,-240101,'BE024 SQL fixture','be024-sql-fixture');

  -- Exactly the old Writer order: chapter first, then a plain content INSERT.
  INSERT INTO public.chapters(chapter_id,novel_id,chapter_number,title) OVERRIDING SYSTEM VALUE
    VALUES(-240301,-240201,1,'BE024 first fixture'),(-240302,-240201,2,'BE024 second fixture');
  IF EXISTS (SELECT 1 FROM public.chapter_contents WHERE chapter_id=-240301) THEN
    RAISE EXCEPTION 'BE02.4: metadata-first insert incorrectly materialized empty content';
  END IF;
  INSERT INTO public.chapter_contents(chapter_id,content) VALUES(-240301,E'Synthetic Unicode kiểm thử\n\nParagraph two');
  IF NOT EXISTS (SELECT 1 FROM public.chapters WHERE chapter_id=-240301 AND content=E'Synthetic Unicode kiểm thử\n\nParagraph two') THEN
    RAISE EXCEPTION 'BE02.4: legacy INSERT synchronization failed';
  END IF;
  INSERT INTO public.chapter_contents(chapter_id,content) VALUES(-240301,'Synthetic legacy upsert')
    ON CONFLICT(chapter_id) DO UPDATE SET content=EXCLUDED.content;
  IF NOT EXISTS (SELECT 1 FROM public.chapters WHERE chapter_id=-240301 AND content='Synthetic legacy upsert') THEN
    RAISE EXCEPTION 'BE02.4: legacy UPSERT synchronization failed';
  END IF;
  UPDATE public.chapters SET content='Synthetic modern write' WHERE chapter_id=-240301;
  IF NOT EXISTS (SELECT 1 FROM public.chapter_contents WHERE chapter_id=-240301 AND content='Synthetic modern write') THEN
    RAISE EXCEPTION 'BE02.4: chapter write-through failed';
  END IF;
  UPDATE public.chapter_contents SET chapter_id=-240302 WHERE chapter_id=-240301;
  IF NOT EXISTS (SELECT 1 FROM public.chapters WHERE chapter_id=-240301 AND content='')
    OR NOT EXISTS (SELECT 1 FROM public.chapters WHERE chapter_id=-240302 AND content='Synthetic modern write') THEN
    RAISE EXCEPTION 'BE02.4: moving legacy content failed';
  END IF;
  DELETE FROM public.chapter_contents WHERE chapter_id=-240302;
  IF EXISTS (SELECT 1 FROM public.chapter_contents WHERE chapter_id=-240302)
    OR NOT EXISTS (SELECT 1 FROM public.chapters WHERE chapter_id=-240302 AND content='') THEN
    RAISE EXCEPTION 'BE02.4: legacy DELETE caused reinsertion or stale content';
  END IF;
  UPDATE public.chapters SET content='Synthetic restored write' WHERE chapter_id=-240301;

  INSERT INTO public.bookshelves(user_id,novel_id) VALUES(-240101,-240201);
  IF NOT EXISTS (SELECT 1 FROM public.bookshelves WHERE user_id=-240101 AND reading_status IS NULL) THEN
    RAISE EXCEPTION 'BE02.4: legacy Library writes must preserve unknown status';
  END IF;
  INSERT INTO public.chapter_likes(user_id,chapter_id) VALUES(-240101,-240301);
  SELECT count_like INTO observed FROM public.chapters WHERE chapter_id=-240301;
  IF observed<>1 THEN RAISE EXCEPTION 'BE02.4: chapter-like counter duplicated'; END IF;
  INSERT INTO public.novel_likes(user_id,novel_id) VALUES(-240101,-240201);
  SELECT count_like INTO observed FROM public.novels WHERE novel_id=-240201;
  IF observed<>1 THEN RAISE EXCEPTION 'BE02.4: novel-like counter duplicated'; END IF;

  INSERT INTO public.comments(comment_id,user_id,chapter_id,content) OVERRIDING SYSTEM VALUE
    VALUES(-9007199254742401,-240101,-240301,'BE024 root'),(-9007199254742402,-240101,-240302,'BE024 other root');
  BEGIN
    INSERT INTO public.comments(comment_id,user_id,chapter_id,parent_id,content) OVERRIDING SYSTEM VALUE
      VALUES(-9007199254742403,-240101,-240301,-9007199254742402,'BE024 invalid reply');
    RAISE EXCEPTION 'BE02.4: cross-chapter parent accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.chapters c JOIN public.chapter_contents cc USING(chapter_id)
    WHERE c.content IS DISTINCT FROM cc.content) THEN
    RAISE EXCEPTION 'BE02.4: content diverged after compatibility operations';
  END IF;
  -- Old manual deletion order must remain valid, including the legacy tables.
  DELETE FROM public.comments WHERE chapter_id=-240301;
  DELETE FROM public.chapter_likes WHERE chapter_id=-240301;
  UPDATE public.reading_progress SET chapter_id=NULL WHERE chapter_id=-240301;
  DELETE FROM public.chapter_contents WHERE chapter_id=-240301;
  DELETE FROM public.chapters WHERE chapter_id=-240301;
  IF EXISTS (SELECT 1 FROM public.chapter_contents WHERE chapter_id=-240301) THEN
    RAISE EXCEPTION 'BE02.4: legacy manual deletion failed';
  END IF;
END;
$compat$;
