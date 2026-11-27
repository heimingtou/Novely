-- Synthetic only. Negative explicit IDs: no real account/content, no nextval.
INSERT INTO public.users(user_id,username,email,password_hash,role) OVERRIDING SYSTEM VALUE VALUES
 (-250101,'be024_staging_author','be024-staging-author@example.invalid','SYNTHETIC_NOT_A_PASSWORD_HASH','author'),
 (-250102,'be024_staging_reader','be024-staging-reader@example.invalid','SYNTHETIC_NOT_A_PASSWORD_HASH','reader');
INSERT INTO public.profiles(user_id,bio) VALUES(-250101,'Synthetic staging'),(-250102,'Synthetic staging');
INSERT INTO public.novels(novel_id,author_id,title,slug) OVERRIDING SYSTEM VALUE VALUES(-250201,-250101,'Synthetic staging novel','be024-staging-novel');
INSERT INTO public.chapters(chapter_id,novel_id,chapter_number,title) OVERRIDING SYSTEM VALUE VALUES(-250301,-250201,1,'Synthetic staging chapter');
INSERT INTO public.chapter_contents VALUES(-250301,E'Synthetic staging Unicode\r\nKiểm thử');
INSERT INTO public.genres(genre_id,name,slug) OVERRIDING SYSTEM VALUE VALUES(-2504,'Synthetic staging','be024-staging');
INSERT INTO public.novel_genres VALUES(-250201,-2504);
INSERT INTO public.bookshelves(user_id,novel_id) VALUES(-250102,-250201);
INSERT INTO public.reading_progress(user_id,novel_id,chapter_id,progress_percent) VALUES(-250102,-250201,-250301,0.5);
INSERT INTO public.reviews(review_id,user_id,novel_id,rating,content) OVERRIDING SYSTEM VALUE VALUES(-250501,-250102,-250201,4,'Synthetic review');
INSERT INTO public.comments(comment_id,user_id,chapter_id,content) OVERRIDING SYSTEM VALUE VALUES(-250601,-250102,-250301,'Synthetic comment');
INSERT INTO public.follows(follower_id,follow_id) VALUES(-250102,-250101);
INSERT INTO public.novel_likes(user_id,novel_id) VALUES(-250102,-250201);
INSERT INTO public.chapter_likes(user_id,chapter_id) VALUES(-250102,-250301);
INSERT INTO public.interact_novel(novel_id) VALUES(-250201);
INSERT INTO public.interact_novel_day(novel_id,day) VALUES(-250201,DATE '2026-11-25');
