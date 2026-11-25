// Test-only synthetic IDs. Identity tables use OVERRIDING SYSTEM VALUE so even
// rollback never calls nextval(). Composite tables use the real Prisma API.
export const ids = Object.freeze({
  author: -230101, reader: -230102, otherUser: -230103,
  novel: -230201, otherNovel: -230202,
  chapter: -230301, otherChapter: -230302, secondChapter: -230303,
  genre: -2301, review: -230401, category: -2301,
  comment: -9007199254742301n, otherComment: -9007199254742302n, reply: -9007199254742303n,
  newComment: -9007199254742304n, newReply: -9007199254742305n,
  post: -9007199254742401n, otherPost: -9007199254742402n,
  forumComment: -9007199254742501n, otherForumComment: -9007199254742502n, forumReply: -9007199254742503n,
  report: -9007199254742601n,
});
export const commitIds = Object.freeze({ author: -231101, reader: -231102, novel: -231201 });

export async function insertFixtures(tx) {
  await tx.$executeRaw`INSERT INTO public.users(user_id,username,email,password_hash,role,updated_at) OVERRIDING SYSTEM VALUE VALUES
    (-230101,'be023_author','be023-author@example.invalid','BE023_SYNTHETIC_HASH_ONLY','author','2000-01-01T00:00:00Z'),
    (-230102,'be023_reader','be023-reader@example.invalid','BE023_SYNTHETIC_HASH_ONLY','reader','2000-01-01T00:00:00Z'),
    (-230103,'be023_other','be023-other@example.invalid','BE023_SYNTHETIC_HASH_ONLY','reader','2000-01-01T00:00:00Z')`;
  await tx.$executeRaw`INSERT INTO public.profiles(user_id,bio) VALUES(-230101,'Synthetic author'),(-230102,'Synthetic reader'),(-230103,'Synthetic other')`;
  await tx.$executeRaw`INSERT INTO public.genres(genre_id,name,slug) OVERRIDING SYSTEM VALUE VALUES(-2301,'BE023 synthetic genre','be023-genre')`;
  await tx.$executeRaw`INSERT INTO public.novels(novel_id,author_id,title,slug,updated_at) OVERRIDING SYSTEM VALUE VALUES
    (-230201,-230101,'BE023 first novel','be023-first-novel','2000-01-01T00:00:00Z'),
    (-230202,-230101,'BE023 second novel','be023-second-novel','2000-01-01T00:00:00Z')`;
  await tx.$executeRaw`INSERT INTO public.novel_genres(novel_id,genre_id) VALUES(-230201,-2301)`;
  await tx.$executeRaw`INSERT INTO public.chapters(chapter_id,novel_id,chapter_number,title,content,updated_at) OVERRIDING SYSTEM VALUE VALUES
    (-230301,-230201,1,'First chapter','Synthetic content\n\nSecond paragraph','2000-01-01T00:00:00Z'),
    (-230302,-230202,1,'Other chapter','Synthetic second novel content','2000-01-01T00:00:00Z'),
    (-230303,-230201,2,'Second chapter','Synthetic continuation','2000-01-01T00:00:00Z')`;
  await tx.$executeRaw`INSERT INTO public.comments(comment_id,user_id,chapter_id,content,parent_id,updated_at) OVERRIDING SYSTEM VALUE VALUES
    (-9007199254742301,-230101,-230301,'Synthetic root',NULL,'2000-01-01T00:00:00Z'),
    (-9007199254742302,-230102,-230302,'Other chapter root',NULL,'2000-01-01T00:00:00Z'),
    (-9007199254742303,-230102,-230301,'Synthetic reply',-9007199254742301,'2000-01-01T00:00:00Z')`;
  await tx.$executeRaw`INSERT INTO public.reviews(review_id,user_id,novel_id,rating,updated_at) OVERRIDING SYSTEM VALUE
    VALUES(-230401,-230102,-230201,4,'2000-01-01T00:00:00Z')`;
  await tx.$executeRaw`INSERT INTO public.interact_novel(novel_id) VALUES(-230201),(-230202)`;
  await tx.$executeRaw`INSERT INTO public.interact_novel_day(novel_id,day) VALUES(-230201,'2026-11-25'),(-230202,'2026-11-25')`;
  await tx.$executeRaw`INSERT INTO public.forum_category(category_id,name) OVERRIDING SYSTEM VALUE VALUES(-2301,'BE023 synthetic discussion')`;
  await tx.$executeRaw`INSERT INTO public.forum_post(post_id,user_id,category_id,title,content,updated_at) OVERRIDING SYSTEM VALUE VALUES
    (-9007199254742401,-230101,-2301,'Synthetic post','BE023 post content','2000-01-01T00:00:00Z'),
    (-9007199254742402,-230102,-2301,'Other synthetic post','BE023 other content','2000-01-01T00:00:00Z')`;
  await tx.$executeRaw`INSERT INTO public.forum_comment(comment_id,post_id,user_id,parent_id,content,updated_at) OVERRIDING SYSTEM VALUE VALUES
    (-9007199254742501,-9007199254742401,-230101,NULL,'Forum root','2000-01-01T00:00:00Z'),
    (-9007199254742502,-9007199254742402,-230102,NULL,'Other post root','2000-01-01T00:00:00Z'),
    (-9007199254742503,-9007199254742401,-230102,-9007199254742501,'Forum reply','2000-01-01T00:00:00Z')`;
  await tx.$executeRaw`INSERT INTO public.forum_report(report_id,user_id,post_id,reason) OVERRIDING SYSTEM VALUE
    VALUES(-9007199254742601,-230102,-9007199254742401,'Synthetic test reason')`;
}

export async function insertCommitParents(tx) {
  await tx.$executeRaw`INSERT INTO public.users(user_id,username,email,password_hash,role) OVERRIDING SYSTEM VALUE VALUES
    (-231101,'be023_commit_author','be023-commit-author@example.invalid','BE023_SYNTHETIC_HASH_ONLY','author'),
    (-231102,'be023_commit_reader','be023-commit-reader@example.invalid','BE023_SYNTHETIC_HASH_ONLY','reader')`;
  await tx.$executeRaw`INSERT INTO public.novels(novel_id,author_id,title,slug) OVERRIDING SYSTEM VALUE
    VALUES(-231201,-231101,'BE023 commit fixture','be023-commit-fixture')`;
}

export async function cleanupCommitParents(prisma) {
  await prisma.$transaction(async (tx) => {
    // Never delete by ID alone: cleanup is restricted to these synthetic markers.
    await tx.novel.deleteMany({ where: { novelId: commitIds.novel, authorId: commitIds.author, slug: "be023-commit-fixture" } });
    await tx.user.deleteMany({ where: { userId: commitIds.reader, username: "be023_commit_reader", email: "be023-commit-reader@example.invalid" } });
    await tx.user.deleteMany({ where: { userId: commitIds.author, username: "be023_commit_author", email: "be023-commit-author@example.invalid" } });
  });
}

export async function isolatedCase(tx, work) {
  await tx.$executeRawUnsafe("SAVEPOINT be023_case");
  try { return await work(); } finally {
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT be023_case");
    await tx.$executeRawUnsafe("RELEASE SAVEPOINT be023_case");
  }
}

export async function countersAreConsistent(tx) {
  const [row] = await tx.$queryRaw`SELECT
    (SELECT count(*)::integer FROM public.chapters c WHERE c.count_comment <>
      (SELECT count(*) FROM public.comments x WHERE x.chapter_id=c.chapter_id AND x.deleted_at IS NULL)) AS comments,
    (SELECT count(*)::integer FROM public.users u WHERE u.count_following <>
      (SELECT count(*) FROM public.follows f WHERE f.follower_id=u.user_id) OR u.count_follower <>
      (SELECT count(*) FROM public.follows f WHERE f.follow_id=u.user_id)) AS follows,
    (SELECT count(*)::integer FROM public.novels n WHERE n.count_like <>
      (SELECT count(*) FROM public.novel_likes l WHERE l.novel_id=n.novel_id)) AS likes`;
  return row.comments === 0 && row.follows === 0 && row.likes === 0;
}
