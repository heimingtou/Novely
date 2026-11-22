-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

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
  count_following integer NOT NULL DEFAULT 0,
  count_follower integer NOT NULL DEFAULT 0,
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
  word_count integer NOT NULL DEFAULT 0,
  count_view integer NOT NULL DEFAULT 0,
  count_like integer NOT NULL DEFAULT 0,
  count_comment integer NOT NULL DEFAULT 0,
  status character varying NOT NULL DEFAULT 'draft'::character varying CHECK (status::text = ANY (ARRAY['draft'::character varying, 'published'::character varying]::text[])),
  title character varying NOT NULL,
  CONSTRAINT chapters_pkey PRIMARY KEY (chapter_id),
  CONSTRAINT fk_chapters_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id)
);
CREATE TABLE public.chapter_contents (
  chapter_id integer NOT NULL,
  content text NOT NULL,
  CONSTRAINT chapter_contents_pkey PRIMARY KEY (chapter_id),
  CONSTRAINT fk_chapter_contents_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapters(chapter_id)
);
CREATE TABLE public.chapter_likes (
  user_id integer NOT NULL,
  chapter_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chapter_likes_pkey PRIMARY KEY (user_id, chapter_id),
  CONSTRAINT fk_chapter_likes_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_chapter_likes_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapters(chapter_id)
);
CREATE TABLE public.bookshelves (
  user_id integer NOT NULL,
  novel_id integer NOT NULL,
  saved_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bookshelves_pkey PRIMARY KEY (user_id, novel_id),
  CONSTRAINT fk_bookshelves_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_bookshelves_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id)
);
CREATE TABLE public.reading_progress (
  user_id integer NOT NULL,
  novel_id integer NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  chapter_id integer,
  progress_percent real NOT NULL DEFAULT 0 CHECK (progress_percent >= 0::double precision AND progress_percent <= 1::double precision),
  CONSTRAINT reading_progress_pkey PRIMARY KEY (user_id, novel_id),
  CONSTRAINT fk_reading_progress_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_reading_progress_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id),
  CONSTRAINT fk_reading_progress_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapters(chapter_id),
  CONSTRAINT fk_reading_progress_chapter FOREIGN KEY (novel_id) REFERENCES public.chapters(novel_id)
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
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_comments_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapters(chapter_id),
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES public.comments(comment_id)
);
CREATE TABLE public.reviews (
  review_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  novel_id integer NOT NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content text,
  CONSTRAINT reviews_pkey PRIMARY KEY (review_id),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_reviews_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id)
);
CREATE TABLE public.interact_novel (
  view bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  novel_id integer NOT NULL,
  under_eighteen integer NOT NULL DEFAULT 0,
  eighteen_to_thirty_five integer NOT NULL DEFAULT 0,
  over_thirty_five integer NOT NULL DEFAULT 0,
  age_unknown integer NOT NULL DEFAULT 0,
  male integer NOT NULL DEFAULT 0,
  female integer NOT NULL DEFAULT 0,
  gender_other integer NOT NULL DEFAULT 0,
  CONSTRAINT interact_novel_pkey PRIMARY KEY (novel_id),
  CONSTRAINT fk_interact_novel_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id)
);
CREATE TABLE public.interact_novel_day (
  novel_id integer NOT NULL,
  day date NOT NULL,
  count_view integer NOT NULL DEFAULT 0,
  count_like integer NOT NULL DEFAULT 0,
  CONSTRAINT interact_novel_day_pkey PRIMARY KEY (novel_id, day),
  CONSTRAINT fk_interact_novel_day_novel FOREIGN KEY (novel_id) REFERENCES public.novels(novel_id)
);