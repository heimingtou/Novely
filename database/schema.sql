-- Novely BE02.1: target schema for the official 19 business tables.
-- PostgreSQL DDL for an EMPTY, ISOLATED test database; NOT a migration script.
-- Do not execute this file against the existing Supabase database.
-- Before migration, preserve chapter_contents.content verbatim in chapters.content
-- and archive chapter_likes plus chapters.count_like outside the target schema.
-- Existing grants, RLS policies and counter-maintenance triggers must be audited
-- separately. DEFAULT now() initializes timestamps; services must set updated_at
-- on subsequent changes. Aggregate counters are not recalculated by this DDL.

BEGIN;

CREATE TABLE public.users (
  user_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email_verified boolean NOT NULL DEFAULT false,
  username character varying NOT NULL UNIQUE CHECK (char_length(username::text) >= 3 AND char_length(username::text) <= 50),
  email character varying NOT NULL UNIQUE CHECK (email::text ~~ '%_@_%._%'::text),
  password_hash character varying NOT NULL,
  role character varying NOT NULL DEFAULT 'reader'::character varying CHECK (role::text = ANY (ARRAY['reader'::character varying, 'author'::character varying, 'admin'::character varying]::text[])),
  count_following integer NOT NULL DEFAULT 0 CHECK (count_following >= 0),
  count_follower integer NOT NULL DEFAULT 0 CHECK (count_follower >= 0),
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.profiles (
  user_id integer NOT NULL,
  birthday date CHECK (birthday >= '1900-01-01'::date AND birthday <= CURRENT_DATE),
  gender character varying CHECK (gender::text = ANY (ARRAY['male'::character varying, 'female'::character varying, 'other'::character varying]::text[])),
  phone_number character varying CHECK (phone_number::text ~ '^\+?[0-9]{9,14}$'::text),
  fb_link character varying CHECK (fb_link::text ~~ 'https://%'::text),
  avatar character varying,
  bio text,
  CONSTRAINT profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.follows (
  follower_id integer NOT NULL,
  follow_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (follower_id, follow_id),
  CONSTRAINT follows_no_self_check CHECK (follower_id <> follow_id),
  CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_follows_follow FOREIGN KEY (follow_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.genres (
  genre_id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL UNIQUE,
  slug character varying NOT NULL UNIQUE CHECK (slug::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text),
  CONSTRAINT genres_pkey PRIMARY KEY (genre_id)
);
CREATE TABLE public.novels (
  novel_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  author_id integer NOT NULL,
  last_chapter_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  count_chapter integer NOT NULL DEFAULT 0 CHECK (count_chapter >= 0),
  published boolean NOT NULL DEFAULT false,
  upper18 boolean NOT NULL DEFAULT false,
  vip boolean NOT NULL DEFAULT false,
  status character varying NOT NULL DEFAULT 'ongoing'::character varying CHECK (status::text = ANY (ARRAY['ongoing'::character varying, 'completed'::character varying]::text[])),
  title character varying NOT NULL CHECK (char_length(TRIM(BOTH FROM title)) > 0),
  slug character varying NOT NULL UNIQUE CHECK (slug::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text),
  cover_url character varying,
  description text,
  count_like integer NOT NULL DEFAULT 0 CHECK (count_like >= 0),
  CONSTRAINT novels_pkey PRIMARY KEY (novel_id),
  CONSTRAINT fk_novels_author FOREIGN KEY (author_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.novel_genres (
  novel_id integer NOT NULL,
  genre_id smallint NOT NULL,
  CONSTRAINT novel_genres_pkey PRIMARY KEY (novel_id, genre_id),
  CONSTRAINT fk_novel_genres_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id),
  CONSTRAINT fk_novel_genres_genre FOREIGN KEY (genre_id) REFERENCES public.genres(genre_id)
);
CREATE TABLE public.novel_likes (
  user_id integer NOT NULL,
  novel_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT novel_likes_pkey PRIMARY KEY (user_id, novel_id),
  CONSTRAINT fk_novel_likes_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_novel_likes_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id)
);
CREATE TABLE public.chapters (
  chapter_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  novel_id integer NOT NULL,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  chapter_number integer NOT NULL CHECK (chapter_number > 0),
  word_count integer NOT NULL DEFAULT 0 CHECK (word_count >= 0),
  count_view integer NOT NULL DEFAULT 0 CHECK (count_view >= 0),
  count_comment integer NOT NULL DEFAULT 0 CHECK (count_comment >= 0),
  status character varying NOT NULL DEFAULT 'draft'::character varying CHECK (status::text = ANY (ARRAY['draft'::character varying, 'published'::character varying]::text[])),
  title character varying NOT NULL CHECK (char_length(TRIM(BOTH FROM title)) > 0),
  content text NOT NULL DEFAULT '',
  CONSTRAINT chapters_pkey PRIMARY KEY (chapter_id),
  CONSTRAINT chapters_novel_number_key UNIQUE (novel_id, chapter_number),
  -- The composite key is required by reading_progress's same-novel foreign key.
  CONSTRAINT chapters_id_novel_key UNIQUE (chapter_id, novel_id),
  CONSTRAINT fk_chapters_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id)
);
CREATE TABLE public.bookshelves (
  user_id integer NOT NULL,
  novel_id integer NOT NULL,
  saved_at timestamp with time zone NOT NULL DEFAULT now(),
  reading_status character varying NOT NULL DEFAULT 'plan_to_read',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bookshelves_pkey PRIMARY KEY (user_id, novel_id),
  CONSTRAINT bookshelves_reading_status_check CHECK (reading_status IN ('plan_to_read', 'reading', 'completed', 'dropped')),
  CONSTRAINT fk_bookshelves_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_bookshelves_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id)
);
CREATE TABLE public.reading_progress (
  user_id integer NOT NULL,
  novel_id integer NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  chapter_id integer,
  progress_percent real NOT NULL DEFAULT 0 CHECK (progress_percent >= 0::double precision AND progress_percent <= 1::double precision),
  -- progress_percent is a fraction [0, 1]; the UI currently displays [0, 100].
  -- scroll_position is a nonnegative vertical offset in pixels, not a paragraph ID.
  scroll_position integer NOT NULL DEFAULT 0 CHECK (scroll_position >= 0),
  CONSTRAINT reading_progress_pkey PRIMARY KEY (user_id, novel_id),
  CONSTRAINT fk_reading_progress_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_reading_progress_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id),
  -- MATCH SIMPLE permits chapter_id = NULL while novel_id remains valid.
  CONSTRAINT fk_reading_progress_chapter FOREIGN KEY (chapter_id, novel_id) REFERENCES public.chapters(chapter_id, novel_id)
);
CREATE TABLE public.comments (
  comment_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  parent_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  user_id integer NOT NULL,
  chapter_id integer NOT NULL,
  content text NOT NULL CHECK (char_length(TRIM(BOTH FROM content)) >= 1 AND char_length(TRIM(BOTH FROM content)) <= 5000),
  CONSTRAINT comments_pkey PRIMARY KEY (comment_id),
  CONSTRAINT comments_id_chapter_key UNIQUE (comment_id, chapter_id),
  CONSTRAINT comments_no_self_parent_check CHECK (parent_id IS NULL OR parent_id <> comment_id),
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_comments_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapters(chapter_id),
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id, chapter_id) REFERENCES public.comments(comment_id, chapter_id)
);
CREATE TABLE public.reviews (
  review_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  novel_id integer NOT NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content text,
  CONSTRAINT reviews_pkey PRIMARY KEY (review_id),
  CONSTRAINT reviews_user_novel_key UNIQUE (user_id, novel_id),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_reviews_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id)
);
CREATE TABLE public.interact_novel (
  view bigint NOT NULL DEFAULT 0 CHECK (view >= 0),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  novel_id integer NOT NULL,
  under_eighteen integer NOT NULL DEFAULT 0 CHECK (under_eighteen >= 0),
  eighteen_to_thirty_five integer NOT NULL DEFAULT 0 CHECK (eighteen_to_thirty_five >= 0),
  over_thirty_five integer NOT NULL DEFAULT 0 CHECK (over_thirty_five >= 0),
  age_unknown integer NOT NULL DEFAULT 0 CHECK (age_unknown >= 0),
  male integer NOT NULL DEFAULT 0 CHECK (male >= 0),
  female integer NOT NULL DEFAULT 0 CHECK (female >= 0),
  gender_other integer NOT NULL DEFAULT 0 CHECK (gender_other >= 0),
  CONSTRAINT interact_novel_pkey PRIMARY KEY (novel_id),
  CONSTRAINT fk_interact_novel_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id)
);
CREATE TABLE public.interact_novel_day (
  novel_id integer NOT NULL,
  day date NOT NULL,
  count_view integer NOT NULL DEFAULT 0 CHECK (count_view >= 0),
  count_like integer NOT NULL DEFAULT 0 CHECK (count_like >= 0),
  CONSTRAINT interact_novel_day_pkey PRIMARY KEY (novel_id, day),
  CONSTRAINT fk_interact_novel_day_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id)
);

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
  -- Initial moderation vocabulary; confirm with the team before migration.
  status character varying NOT NULL DEFAULT 'published',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT forum_post_pkey PRIMARY KEY (post_id),
  CONSTRAINT forum_post_status_check CHECK (status IN ('published', 'hidden', 'deleted')),
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
  CONSTRAINT forum_comment_id_post_key UNIQUE (comment_id, post_id),
  CONSTRAINT forum_comment_no_self_parent_check CHECK (parent_id IS NULL OR parent_id <> comment_id),
  CONSTRAINT fk_forum_comment_post FOREIGN KEY (post_id) REFERENCES public.forum_post(post_id),
  CONSTRAINT fk_forum_comment_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_forum_comment_parent FOREIGN KEY (parent_id, post_id) REFERENCES public.forum_comment(comment_id, post_id)
);

CREATE TABLE public.forum_reaction (
  user_id integer NOT NULL,
  post_id bigint NOT NULL,
  -- One active reaction per user/post, matching the current toggle interaction.
  reaction_type character varying NOT NULL DEFAULT 'like',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT forum_reaction_pkey PRIMARY KEY (user_id, post_id),
  CONSTRAINT forum_reaction_type_check CHECK (reaction_type IN ('like', 'love', 'wow')),
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
  CONSTRAINT forum_report_status_check CHECK (status IN ('pending', 'resolved', 'dismissed')),
  CONSTRAINT fk_forum_report_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_forum_report_post FOREIGN KEY (post_id) REFERENCES public.forum_post(post_id)
);

-- PK/UNIQUE constraints already create indexes. The following indexes cover
-- foreign-key lookups in the opposite direction and existing list/filter paths.
-- Keep default NO ACTION delete behavior: no implicit deletion of user content.
CREATE INDEX follows_follow_created_idx ON public.follows (follow_id, created_at DESC);
CREATE INDEX novels_author_updated_idx ON public.novels (author_id, updated_at DESC);
CREATE INDEX novels_published_latest_idx ON public.novels (published, last_chapter_at DESC, novel_id);
CREATE INDEX novels_published_likes_idx ON public.novels (published, count_like DESC, novel_id);
CREATE INDEX novel_genres_genre_novel_idx ON public.novel_genres (genre_id, novel_id);
CREATE INDEX novel_likes_novel_created_idx ON public.novel_likes (novel_id, created_at DESC);
CREATE INDEX chapters_novel_status_number_idx ON public.chapters (novel_id, status, chapter_number);
CREATE INDEX bookshelves_novel_idx ON public.bookshelves (novel_id);
CREATE INDEX bookshelves_user_status_updated_idx ON public.bookshelves (user_id, reading_status, updated_at DESC);
CREATE INDEX reading_progress_novel_idx ON public.reading_progress (novel_id);
CREATE INDEX reading_progress_chapter_novel_idx ON public.reading_progress (chapter_id, novel_id);
CREATE INDEX reading_progress_user_last_read_idx ON public.reading_progress (user_id, last_read_at DESC);
CREATE INDEX comments_chapter_deleted_created_idx ON public.comments (chapter_id, deleted_at, created_at DESC);
CREATE INDEX comments_user_created_idx ON public.comments (user_id, created_at DESC);
CREATE INDEX comments_parent_chapter_idx ON public.comments (parent_id, chapter_id);
CREATE INDEX reviews_novel_created_idx ON public.reviews (novel_id, created_at DESC);
CREATE INDEX forum_post_user_created_idx ON public.forum_post (user_id, created_at DESC);
CREATE INDEX forum_post_category_status_created_idx ON public.forum_post (category_id, status, created_at DESC, post_id DESC);
CREATE INDEX forum_post_status_created_idx ON public.forum_post (status, created_at DESC, post_id DESC);
CREATE INDEX forum_comment_post_created_idx ON public.forum_comment (post_id, created_at, comment_id);
CREATE INDEX forum_comment_user_created_idx ON public.forum_comment (user_id, created_at DESC);
CREATE INDEX forum_comment_parent_post_idx ON public.forum_comment (parent_id, post_id);
CREATE INDEX forum_reaction_post_type_idx ON public.forum_reaction (post_id, reaction_type);
CREATE INDEX forum_report_user_created_idx ON public.forum_report (user_id, created_at DESC);
CREATE INDEX forum_report_post_created_idx ON public.forum_report (post_id, created_at DESC);
CREATE INDEX forum_report_status_created_idx ON public.forum_report (status, created_at);

COMMIT;
