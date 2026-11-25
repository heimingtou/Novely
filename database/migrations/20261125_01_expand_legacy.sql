-- BE02.4 EXPAND migration, PostgreSQL 17+. Keep all 16 legacy tables/data.
-- REQUIRED: execute in one explicit transaction, with stop-on-error enabled.
-- psql example AFTER approval: -X --single-transaction -v ON_ERROR_STOP=1 -f ...
-- This is not database/schema.sql and not a Prisma migration/db push.
-- Local tooling is pinned to novely_restore_test. Cloud execution is manual only.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preflight$
DECLARE actual text[];
BEGIN
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'PostgreSQL 17 or newer required';
  END IF;
  SELECT array_agg(tablename::text ORDER BY tablename) INTO actual
    FROM pg_catalog.pg_tables WHERE schemaname='public';
  IF actual IS DISTINCT FROM ARRAY['bookshelves','chapter_contents','chapter_likes','chapters',
    'comments','follows','genres','interact_novel','interact_novel_day','novel_genres',
    'novel_likes','novels','profiles','reading_progress','reviews','users'] THEN
    RAISE EXCEPTION 'STOP: expected the unmodified 16-table legacy schema';
  END IF;
  IF to_regprocedure('public.recalc_counters()') IS NULL
    OR to_regprocedure('public.set_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'STOP: expected legacy functions are missing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chapters c LEFT JOIN public.chapter_contents cc USING(chapter_id)
    WHERE cc.chapter_id IS NULL) THEN
    RAISE EXCEPTION 'STOP: missing legacy content; do not silently backfill empty strings';
  END IF;
  IF EXISTS (SELECT 1 FROM public.comments c JOIN public.comments p ON p.comment_id=c.parent_id
    WHERE c.chapter_id<>p.chapter_id) THEN
    RAISE EXCEPTION 'STOP: cross-chapter replies require data reconciliation';
  END IF;
  -- The restored legacy trigger is column-scoped and excludes content. Backfill
  -- must happen before expanding it, to preserve original updated_at values.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid='public.chapters'::regclass AND t.tgname='trg_chapters_updated'
      AND t.tgenabled='O' AND t.tgfoid='public.set_updated_at()'::regprocedure)
    OR EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='chapters' AND column_name='content') THEN
    RAISE EXCEPTION 'STOP: chapter timestamp/content baseline differs';
  END IF;
END;
$preflight$;

-- A short maintenance window is required. Lock writers while backfill, indexes
-- and synchronization triggers are installed atomically; use a stable order.
LOCK TABLE public.bookshelves, public.chapter_contents, public.chapter_likes,
  public.chapters, public.comments, public.follows, public.genres,
  public.interact_novel, public.interact_novel_day, public.novel_genres,
  public.novel_likes, public.novels, public.profiles, public.reading_progress,
  public.reviews, public.users IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.bookshelves
  ADD COLUMN reading_status character varying,
  ADD COLUMN updated_at timestamp with time zone;
-- NULL means unknown: no inference from saved_at or reading_progress.
UPDATE public.bookshelves SET updated_at=saved_at;
ALTER TABLE public.bookshelves
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL,
  ADD CONSTRAINT bookshelves_reading_status_check
    CHECK (reading_status IN ('plan_to_read','reading','completed','dropped'));

ALTER TABLE public.reading_progress
  ADD COLUMN scroll_position integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT reading_progress_scroll_position_check CHECK (scroll_position>=0);

ALTER TABLE public.reviews ADD COLUMN updated_at timestamp with time zone;
UPDATE public.reviews SET updated_at=created_at;
ALTER TABLE public.reviews
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.chapters ADD COLUMN content text NOT NULL DEFAULT '';
UPDATE public.chapters c SET content=cc.content
  FROM public.chapter_contents cc WHERE cc.chapter_id=c.chapter_id;

-- Preserve the old FK and its name/delete action. The additional composite FK
-- enforces same-chapter replies without breaking old PostgREST FK hints.
ALTER TABLE public.comments
  ADD CONSTRAINT comments_id_chapter_key UNIQUE (comment_id,chapter_id),
  ADD CONSTRAINT fk_comments_parent_same_chapter FOREIGN KEY (parent_id,chapter_id)
    REFERENCES public.comments(comment_id,chapter_id) ON DELETE CASCADE;

-- Five Forum tables are taken from the accepted target design.
CREATE TABLE public.forum_category (
  category_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL CHECK (char_length(TRIM(BOTH FROM name)) BETWEEN 1 AND 100),
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT forum_category_pkey PRIMARY KEY (category_id),
  CONSTRAINT forum_category_name_key UNIQUE (name)
);
CREATE TABLE public.forum_post (
  post_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id integer NOT NULL,
  category_id integer NOT NULL,
  title character varying NOT NULL CHECK (char_length(TRIM(BOTH FROM title)) BETWEEN 1 AND 150),
  content text NOT NULL CHECK (char_length(TRIM(BOTH FROM content)) BETWEEN 1 AND 5000),
  status character varying NOT NULL DEFAULT 'published',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT forum_post_pkey PRIMARY KEY (post_id),
  CONSTRAINT forum_post_status_check CHECK (status IN ('published','hidden','deleted')),
  CONSTRAINT fk_forum_post_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_forum_post_category FOREIGN KEY (category_id) REFERENCES public.forum_category(category_id)
);
CREATE TABLE public.forum_comment (
  comment_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  post_id bigint NOT NULL,
  user_id integer NOT NULL,
  parent_id bigint,
  content text NOT NULL CHECK (char_length(TRIM(BOTH FROM content)) BETWEEN 1 AND 2000),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT forum_comment_pkey PRIMARY KEY (comment_id),
  CONSTRAINT forum_comment_id_post_key UNIQUE (comment_id,post_id),
  CONSTRAINT forum_comment_no_self_parent_check CHECK (parent_id IS NULL OR parent_id<>comment_id),
  CONSTRAINT fk_forum_comment_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_forum_comment_post FOREIGN KEY (post_id) REFERENCES public.forum_post(post_id),
  CONSTRAINT fk_forum_comment_parent FOREIGN KEY (parent_id,post_id)
    REFERENCES public.forum_comment(comment_id,post_id)
);
CREATE TABLE public.forum_reaction (
  user_id integer NOT NULL,
  post_id bigint NOT NULL,
  reaction_type character varying NOT NULL DEFAULT 'like',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT forum_reaction_pkey PRIMARY KEY (user_id,post_id),
  CONSTRAINT forum_reaction_type_check CHECK (reaction_type IN ('like','love','wow')),
  CONSTRAINT fk_forum_reaction_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_forum_reaction_post FOREIGN KEY (post_id) REFERENCES public.forum_post(post_id)
);
CREATE TABLE public.forum_report (
  report_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id integer NOT NULL,
  post_id bigint NOT NULL,
  reason text NOT NULL CHECK (char_length(TRIM(BOTH FROM reason)) BETWEEN 1 AND 2000),
  status character varying NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT forum_report_pkey PRIMARY KEY (report_id),
  CONSTRAINT forum_report_status_check CHECK (status IN ('pending','resolved','dismissed')),
  CONSTRAINT fk_forum_report_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_forum_report_post FOREIGN KEY (post_id) REFERENCES public.forum_post(post_id)
);
ALTER TABLE public.forum_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_post ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_report ENABLE ROW LEVEL SECURITY;
-- No permissive policies or broad grants. App-role/RLS tests are a deployment gate.

CREATE TRIGGER trg_bookshelves_updated_at BEFORE UPDATE ON public.bookshelves
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_forum_post_updated_at BEFORE UPDATE ON public.forum_post
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_forum_comment_updated_at BEFORE UPDATE ON public.forum_comment
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Expand only the existing chapter timestamp trigger; do not install a second
-- overlapping trigger or touch the old counter functions/recalc_counters().
CREATE OR REPLACE TRIGGER trg_chapters_updated
BEFORE UPDATE OF novel_id,published_at,chapter_number,word_count,status,title,content ON public.chapters
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE FUNCTION public.novely_sync_legacy_content()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $function$
BEGIN
  IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND OLD.chapter_id<>NEW.chapter_id) THEN
    UPDATE public.chapters SET content='' WHERE chapter_id=OLD.chapter_id AND content<>'';
  END IF;
  IF TG_OP<>'DELETE' THEN
    UPDATE public.chapters SET content=NEW.content
      WHERE chapter_id=NEW.chapter_id AND
        pg_catalog.convert_to(content,'UTF8') IS DISTINCT FROM pg_catalog.convert_to(NEW.content,'UTF8');
  END IF;
  RETURN NULL;
END;
$function$;

CREATE FUNCTION public.novely_sync_chapter_content()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $function$
BEGIN
  -- Legacy-trigger-driven updates already have their source row (or deletion).
  -- Avoid reverse reinsertion on DELETE and recursive synchronization.
  IF pg_catalog.pg_trigger_depth()>1 THEN RETURN NULL; END IF;
  -- Legacy Writer inserts chapter metadata first, then plain INSERTs its content.
  -- Do not pre-create an empty legacy row and cause a duplicate-key failure.
  IF TG_OP='INSERT' AND NEW.content='' THEN RETURN NULL; END IF;
  IF TG_OP='UPDATE' AND pg_catalog.convert_to(NEW.content,'UTF8') IS NOT DISTINCT FROM pg_catalog.convert_to(OLD.content,'UTF8') THEN RETURN NULL; END IF;
  INSERT INTO public.chapter_contents AS cc(chapter_id,content) VALUES(NEW.chapter_id,NEW.content)
    ON CONFLICT(chapter_id) DO UPDATE SET content=EXCLUDED.content
      WHERE pg_catalog.convert_to(cc.content,'UTF8') IS DISTINCT FROM pg_catalog.convert_to(EXCLUDED.content,'UTF8');
  RETURN NULL;
END;
$function$;
CREATE TRIGGER trg_novely_legacy_content_sync
AFTER INSERT OR DELETE OR UPDATE OF chapter_id,content ON public.chapter_contents
FOR EACH ROW EXECUTE FUNCTION public.novely_sync_legacy_content();
CREATE TRIGGER trg_novely_chapter_content_sync
AFTER INSERT OR UPDATE OF content ON public.chapters
FOR EACH ROW EXECUTE FUNCTION public.novely_sync_chapter_content();

-- Reuse exact equivalent indexes even when legacy names differ. Keep every old
-- index; similar prefixes are not necessarily identical sort/covering paths.
DO $indexes$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('follows_follow_created_idx','follows','follow_id, created_at DESC'),
    ('novels_author_updated_idx','novels','author_id, updated_at DESC'),
    ('novels_published_latest_idx','novels','published, last_chapter_at DESC, novel_id'),
    ('novels_published_likes_idx','novels','published, count_like DESC, novel_id'),
    ('novel_genres_genre_novel_idx','novel_genres','genre_id, novel_id'),
    ('novel_likes_novel_created_idx','novel_likes','novel_id, created_at DESC'),
    ('chapters_novel_status_number_idx','chapters','novel_id, status, chapter_number'),
    ('bookshelves_novel_idx','bookshelves','novel_id'),
    ('bookshelves_user_status_updated_idx','bookshelves','user_id, reading_status, updated_at DESC'),
    ('reading_progress_novel_idx','reading_progress','novel_id'),
    ('reading_progress_chapter_novel_idx','reading_progress','chapter_id, novel_id'),
    ('reading_progress_user_last_read_idx','reading_progress','user_id, last_read_at DESC'),
    ('comments_chapter_deleted_created_idx','comments','chapter_id, deleted_at, created_at DESC'),
    ('comments_user_created_idx','comments','user_id, created_at DESC'),
    ('comments_parent_chapter_idx','comments','parent_id, chapter_id'),
    ('reviews_novel_created_idx','reviews','novel_id, created_at DESC'),
    ('interact_novel_day_day_novel_idx','interact_novel_day','day, novel_id'),
    ('forum_post_user_created_idx','forum_post','user_id, created_at DESC'),
    ('forum_post_category_status_created_idx','forum_post','category_id, status, created_at DESC, post_id DESC'),
    ('forum_post_status_created_idx','forum_post','status, created_at DESC, post_id DESC'),
    ('forum_comment_post_created_idx','forum_comment','post_id, created_at, comment_id'),
    ('forum_comment_user_created_idx','forum_comment','user_id, created_at DESC'),
    ('forum_comment_parent_post_idx','forum_comment','parent_id, post_id'),
    ('forum_reaction_post_type_idx','forum_reaction','post_id, reaction_type'),
    ('forum_report_user_created_idx','forum_report','user_id, created_at DESC'),
    ('forum_report_post_created_idx','forum_report','post_id, created_at DESC'),
    ('forum_report_status_created_idx','forum_report','status, created_at')
  ) x(index_name,table_name,columns_sql) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_index i
      WHERE i.indrelid=to_regclass('public.'||item.table_name) AND i.indisvalid
      AND substring(pg_catalog.pg_get_indexdef(i.indexrelid) FROM 'USING btree (.*)$')='('||item.columns_sql||')') THEN
      EXECUTE format('CREATE INDEX %I ON public.%I (%s)',item.index_name,item.table_name,item.columns_sql);
    END IF;
  END LOOP;
END;
$indexes$;

DO $postflight$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public')<>21 THEN
    RAISE EXCEPTION 'Expected exactly 21 transitional business tables';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chapters c JOIN public.chapter_contents cc USING(chapter_id)
    WHERE pg_catalog.convert_to(c.content,'UTF8') IS DISTINCT FROM pg_catalog.convert_to(cc.content,'UTF8')) THEN
    RAISE EXCEPTION 'Content backfill mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chapters c LEFT JOIN public.chapter_contents cc USING(chapter_id)
    WHERE cc.chapter_id IS NULL) THEN
    RAISE EXCEPTION 'A legacy two-step chapter write is incomplete; finish it and retry';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public'
    AND tablename LIKE 'forum_%' AND rowsecurity)<>5 THEN
    RAISE EXCEPTION 'Forum RLS was not enabled';
  END IF;
END;
$postflight$;
NOTIFY pgrst,'reload schema';
