import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma-transition/index.js";
import { createBookshelfRepository } from "../src/modules/library/bookshelf.repository.js";
import { createTransactionRunner } from "../src/database/transaction.js";
import { mapDatabaseError } from "../src/shared/errors/database-error.js";
import { isolatedCase } from "../integration/helpers/be02_3-fixtures.js";
import { catalog, contentSummary, dataSignatures, forumTables, legacyCounts, legacyTables, migrationPath, openRestore, restoreConfig, rowCounts } from "../scripts/lib/restore-target.js";
import test from "node:test";

const safe = (error) => new Error(`Local transition check failed; private details suppressed. ${JSON.stringify(mapDatabaseError(error)?.diagnostic ?? { code: /^[0-9A-Z]{5}$/.test(error?.code ?? "") ? error.code : undefined })}`);
const withoutSequenceValues = (metadata) => ({ ...metadata, sequences: metadata.sequences.map(({ last_value, ...rest }) => rest) });

test("BE02.4 transition on Local restored data, aggregate-only reporting", { timeout: 90_000 }, async (context) => {
  const { pool, client: audit } = await openRestore();
  const driverPool = new pg.Pool(restoreConfig().pool);
  driverPool.on("error", () => {});
  const prisma = new PrismaClient({ adapter: new PrismaPg(driverPool, { schema: "public", disposeExternalPool: false }), log: [], errorFormat: "minimal" });
  let locked = false;
  context.after(async () => {
    try { await prisma.$disconnect(); } finally {
      await driverPool.end();
      if (locked) await audit.query("SELECT pg_advisory_unlock(230004)");
      audit.release(); await pool.end();
    }
  });
  try {
    locked = (await audit.query("SELECT pg_try_advisory_lock(230004) AS locked")).rows[0].locked;
    assert.equal(locked, true);
    const before = await catalog(audit);
    assert.equal(before.tables.length, 21);
    assert.equal(before.indexes.length, 70);
    assert.equal(before.triggers.length, 14);
    assert.equal(before.functions.length, 7);
    assert.deepEqual(await rowCounts(audit), legacyCounts);
    const signatures = await dataSignatures(audit, before.columns);
    const sourceSql = await readFile(new URL("../../database/schema.sql", import.meta.url), "utf8");
    const mainSchema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
    const caseTest = (name, work) => context.test(name, async () => { try { await work(); } catch (error) { throw safe(error); } });

    await caseTest("all 19 mapped Prisma models can count the 21-table transition", async () => {
      for (const model of Prisma.dmmf.datamodel.models) {
        const delegate = model.name[0].toLowerCase() + model.name.slice(1);
        assert.equal(await prisma[delegate].count(), legacyCounts[model.dbName] ?? 0);
      }
    });
    await caseTest("all original Library statuses stay unknown and timestamp backfill uses known dates", async () => {
      assert.equal(await prisma.bookshelf.count({ where: { readingStatus: null } }), 642);
      const [{ badLibrary, badReview, badScroll }] = (await audit.query(`SELECT
        (SELECT count(*)::integer FROM public.bookshelves WHERE updated_at IS DISTINCT FROM saved_at) AS "badLibrary",
        (SELECT count(*)::integer FROM public.reviews WHERE updated_at IS DISTINCT FROM created_at) AS "badReview",
        (SELECT count(*)::integer FROM public.reading_progress WHERE scroll_position<>0) AS "badScroll"`)).rows;
      assert.equal(badLibrary + badReview + badScroll, 0);
    });
    await caseTest("all 1054 original chapter contents are byte-identical in both columns", async () => {
      assert.deepEqual(await contentSummary(audit), { chapters: 1054, legacy_contents: 1054, mismatches: 0, missing_nonempty: 0 });
    });
    await caseTest("legacy reader, Writer statistics and catalog SQL projections still compile", async () => {
      // Parse/execute the old query shapes while returning aggregate results only.
      const shapes = [
        `SELECT count(*)::integer FROM (SELECT c.chapter_id,c.chapter_number,c.title,c.word_count,c.count_view,c.count_like,c.count_comment,c.published_at,cc.content FROM public.chapters c LEFT JOIN public.chapter_contents cc USING(chapter_id) WHERE c.status='published') old_reader`,
        `SELECT count(*)::integer FROM (SELECT n.novel_id,n.title,n.slug,n.count_like,n.count_chapter,u.username,p.avatar,i.view FROM public.novels n JOIN public.users u ON u.user_id=n.author_id LEFT JOIN public.profiles p ON p.user_id=u.user_id LEFT JOIN public.interact_novel i USING(novel_id)) old_novels`,
        `SELECT count(*)::integer FROM (SELECT day,count_view,count_like FROM public.interact_novel_day) old_writer_statistics`,
      ];
      for (const sql of shapes) assert.ok((await audit.query(sql)).rows[0].count > 0);
      assert.ok(before.allFunctions.some((fn) => fn.name === "recalc_counters" && fn.definition.includes("chapter_likes")));
    });
    await caseTest("indexes are valid and no exact duplicate index was added", async () => {
      assert.ok(before.indexes.every((index) => index.valid && index.ready));
      const [{ duplicates }] = (await audit.query(`SELECT count(*)::integer AS duplicates FROM (
        SELECT i.indrelid,i.indkey,i.indclass,i.indcollation,i.indoption,i.indexprs::text,i.indpred::text
        FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' GROUP BY i.indrelid,i.indkey,i.indclass,i.indcollation,i.indoption,i.indexprs::text,i.indpred::text HAVING count(*)>1) duplicate_groups`)).rows;
      assert.equal(duplicates, 0);
    });
    await caseTest("a second migration attempt stops before changing the transition", async () => {
      await audit.query("BEGIN");
      try { await assert.rejects(audit.query(await readFile(migrationPath, "utf8")), (error) => error.code === "P0001"); }
      finally { await audit.query("ROLLBACK"); }
    });

    const rollback = new Error("BE024_FIXTURES_ROLLBACK");
    const nonce = randomUUID().slice(0, 8);
    const run = createTransactionRunner({ getClient: async () => prisma });
    try {
      await run(async (transaction) => {
        const author = await transaction.user.create({ data: { username: `be024_a_${nonce}`, email: `be024-a-${nonce}@example.invalid`, passwordHash: "BE024_SYNTHETIC_HASH_ONLY", role: "author" }, select: { userId: true } });
        const reader = await transaction.user.create({ data: { username: `be024_r_${nonce}`, email: `be024-r-${nonce}@example.invalid`, passwordHash: "BE024_SYNTHETIC_HASH_ONLY" }, select: { userId: true } });
        const genre = await transaction.genre.create({ data: { name: `BE024 ${nonce}`, slug: `be024-${nonce}` } });
        const novel = await transaction.novel.create({ data: { authorId: author.userId, title: "BE024 synthetic novel", slug: `be024-novel-${nonce}` } });
        const chapter = await transaction.chapter.create({ data: { novelId: novel.novelId, chapterNumber: 1, title: "BE024 synthetic first" } });
        const merged = await transaction.chapter.create({ data: { novelId: novel.novelId, chapterNumber: 2, title: "BE024 synthetic second", content: "Synthetic merged content" } });
        const comment = await transaction.comment.create({ data: { userId: reader.userId, chapterId: chapter.chapterId, content: "Synthetic comment" } });
        const review = await transaction.review.create({ data: { userId: reader.userId, novelId: novel.novelId, rating: 4 } });
        const category = await transaction.forumCategory.create({ data: { name: `BE024 category ${nonce}` } });
        const post = await transaction.forumPost.create({ data: { userId: author.userId, categoryId: category.categoryId, title: "Synthetic Forum post", content: "Synthetic Forum body" } });
        const forumComment = await transaction.forumComment.create({ data: { userId: reader.userId, postId: post.postId, content: "Synthetic Forum comment" } });
        await transaction.forumReport.create({ data: { userId: reader.userId, postId: post.postId, reason: "Synthetic report reason" } });
        await transaction.forumReaction.create({ data: { userId: reader.userId, postId: post.postId, reactionType: "like" } });
        const repository = createBookshelfRepository({ getClient: () => { throw new Error("Root client used unexpectedly"); } });
        const pair = { userId: reader.userId, novelId: novel.novelId };
        const inner = (name, work) => caseTest(name, () => isolatedCase(transaction, work));

        await inner("Prisma generated identities work for all ten old/new identity columns", async () => {
          for (const value of [author.userId, genre.genreId, novel.novelId, chapter.chapterId, review.reviewId, category.categoryId]) assert.ok(Number.isInteger(value) && value > 0);
          assert.equal(typeof comment.commentId, "bigint");
          assert.equal(typeof post.postId, "bigint");
          assert.equal(typeof forumComment.commentId, "bigint");
          assert.equal(await transaction.forumReport.count({ where: { userId: reader.userId } }), 1);
        });
        await inner("legacy metadata-first creation still permits plain chapter_contents INSERT", async () => {
          assert.equal((await transaction.$queryRaw`SELECT count(*)::integer AS count FROM public.chapter_contents WHERE chapter_id=${chapter.chapterId}`)[0].count, 0);
          const content = "Synthetic Unicode kiểm thử\r\n\r\nSecond paragraph\n末尾";
          await transaction.$executeRaw`INSERT INTO public.chapter_contents(chapter_id,content) VALUES(${chapter.chapterId},${content})`;
          const row = await transaction.chapter.findUnique({ where: { chapterId: chapter.chapterId }, select: { content: true } });
          assert.equal(row.content, content);
        });
        await inner("Prisma merged content INSERT is visible to the legacy reader", async () => {
          const [row] = await transaction.$queryRaw`SELECT content FROM public.chapter_contents WHERE chapter_id=${merged.chapterId}`;
          assert.equal(row.content, "Synthetic merged content");
        });
        await inner("legacy content UPSERT and modern content UPDATE synchronize without recursion", async () => {
          await transaction.$executeRaw`INSERT INTO public.chapter_contents(chapter_id,content) VALUES(${chapter.chapterId},'Synthetic legacy upsert') ON CONFLICT(chapter_id) DO UPDATE SET content=EXCLUDED.content`;
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: chapter.chapterId }, select: { content: true } })).content, "Synthetic legacy upsert");
          await transaction.chapter.update({ where: { chapterId: chapter.chapterId }, data: { content: "Synthetic modern update" } });
          assert.equal((await transaction.$queryRaw`SELECT content FROM public.chapter_contents WHERE chapter_id=${chapter.chapterId}`)[0].content, "Synthetic modern update");
        });
        await inner("legacy content DELETE does not recreate its row", async () => {
          await transaction.$executeRaw`DELETE FROM public.chapter_contents WHERE chapter_id=${merged.chapterId}`;
          assert.equal((await transaction.$queryRaw`SELECT count(*)::integer AS count FROM public.chapter_contents WHERE chapter_id=${merged.chapterId}`)[0].count, 0);
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: merged.chapterId }, select: { content: true } })).content, "");
        });
        await inner("Library CRUD reuses the existing repository and preserves nullable status", async () => {
          await transaction.$executeRaw`INSERT INTO public.bookshelves(user_id,novel_id) VALUES(${reader.userId},${novel.novelId})`;
          assert.equal((await repository.find(pair.userId, pair.novelId, { transaction })).readingStatus, null);
          assert.equal((await repository.updateStatus(pair.userId, pair.novelId, "reading", { transaction })).readingStatus, "reading");
          await repository.remove(pair.userId, pair.novelId, { transaction });
          assert.equal(await repository.find(pair.userId, pair.novelId, { transaction }), null);
          assert.equal((await repository.create(pair, { transaction })).readingStatus, "plan_to_read");
        });
        const invalidCases = [
          ["Library rejects an unknown reading status", "23514", () => transaction.bookshelf.create({ data: { ...pair, readingStatus: "unknown_status" } })],
          ["Reading Progress rejects a negative pixel position", "23514", () => transaction.readingProgress.create({ data: { ...pair, chapterId: chapter.chapterId, scrollPosition: -1 } })],
          ["Forum category names remain unique", "23505", () => transaction.forumCategory.create({ data: { name: category.name } })],
          ["Forum rejects a blank category name", "23514", () => transaction.forumCategory.update({ where: { categoryId: category.categoryId }, data: { name: "   " } })],
          ["Forum rejects an unknown post status", "23514", () => transaction.forumPost.update({ where: { postId: post.postId }, data: { status: "invalid" } })],
          ["Forum rejects blank post content", "23514", () => transaction.forumPost.update({ where: { postId: post.postId }, data: { content: "   " } })],
          ["Forum rejects blank comment content", "23514", () => transaction.forumComment.update({ where: { commentId: forumComment.commentId }, data: { content: "   " } })],
          ["Forum reaction composite key prevents a second reaction", "23505", () => transaction.forumReaction.create({ data: { userId: reader.userId, postId: post.postId } })],
          ["Forum rejects an unsupported reaction type", "23514", () => transaction.forumReaction.update({ where: { userId_postId: { userId: reader.userId, postId: post.postId } }, data: { reactionType: "invalid" } })],
          ["Forum rejects an unknown report status", "23514", () => transaction.forumReport.updateMany({ where: { postId: post.postId }, data: { status: "invalid" } })],
          ["Forum rejects a blank report reason", "23514", () => transaction.forumReport.create({ data: { userId: author.userId, postId: post.postId, reason: "   " } })],
          ["Forum preserves NO ACTION when deleting a referenced post", "23503", () => transaction.forumPost.delete({ where: { postId: post.postId } })],
        ];
        for (const [name, sqlState, operation] of invalidCases) {
          await inner(name, () => assert.rejects(operation(), (error) => mapDatabaseError(error)?.diagnostic.sqlState === sqlState));
        }
        await inner("Library composite key prevents duplicate saves", async () => {
          await transaction.bookshelf.create({ data: { ...pair, readingStatus: "reading" } });
          await assert.rejects(transaction.bookshelf.create({ data: { ...pair, readingStatus: "completed" } }), (error) => mapDatabaseError(error)?.diagnostic.sqlState === "23505");
        });
        await inner("Forum composite parent key rejects replies on another post", async () => {
          const other = await transaction.forumPost.create({ data: { userId: author.userId, categoryId: category.categoryId, title: "Synthetic other post", content: "Synthetic other content" } });
          await assert.rejects(transaction.forumComment.create({ data: { userId: reader.userId, postId: other.postId, parentId: forumComment.commentId, content: "Synthetic invalid reply" } }), (error) => mapDatabaseError(error)?.diagnostic.sqlState === "23503");
        });
        await inner("Forum updates set timestamps and deletion in child-first order succeeds", async () => {
          const oldDate = new Date("2000-01-01T00:00:00Z");
          const changedPost = await transaction.forumPost.update({ where: { postId: post.postId }, data: { title: "Synthetic changed title", updatedAt: oldDate } });
          const changedComment = await transaction.forumComment.update({ where: { commentId: forumComment.commentId }, data: { content: "Synthetic changed comment", updatedAt: oldDate } });
          const [{ now }] = await transaction.$queryRaw`SELECT transaction_timestamp() AS now`;
          assert.equal(changedPost.updatedAt.toISOString(), now.toISOString());
          assert.equal(changedComment.updatedAt.toISOString(), now.toISOString());
          await transaction.forumComment.delete({ where: { commentId: forumComment.commentId } });
          await transaction.forumReaction.deleteMany({ where: { postId: post.postId } });
          await transaction.forumReport.deleteMany({ where: { postId: post.postId } });
          await transaction.forumPost.delete({ where: { postId: post.postId } });
          await transaction.forumCategory.delete({ where: { categoryId: category.categoryId } });
          assert.equal(await transaction.forumPost.count({ where: { postId: post.postId } }), 0);
        });
        await inner("Library and review updates use the shared timestamp function", async () => {
          const oldDate = new Date("2000-01-01T00:00:00Z");
          await transaction.$executeRaw`INSERT INTO public.bookshelves(user_id,novel_id,updated_at) VALUES(${reader.userId},${novel.novelId},${oldDate})`;
          const shelf = await repository.updateStatus(pair.userId, pair.novelId, "reading", { transaction });
          const updatedReview = await transaction.review.update({ where: { reviewId: review.reviewId }, data: { rating: 5, updatedAt: oldDate } });
          const [{ now }] = await transaction.$queryRaw`SELECT transaction_timestamp() AS now`;
          assert.equal(shelf.updatedAt.toISOString(), now.toISOString());
          assert.equal(updatedReview.updatedAt.toISOString(), now.toISOString());
        });
        await inner("existing novel/chapter like counters increment once", async () => {
          await transaction.novelLike.create({ data: pair });
          await transaction.$executeRaw`INSERT INTO public.chapter_likes(user_id,chapter_id) VALUES(${reader.userId},${chapter.chapterId})`;
          assert.equal((await transaction.novel.findUnique({ where: { novelId: novel.novelId } })).countLike, 1);
          const [row] = await transaction.$queryRaw`SELECT count_like FROM public.chapters WHERE chapter_id=${chapter.chapterId}`;
          assert.equal(row.count_like, 1);
        });
        await inner("existing follow/comment counters and soft delete/restore stay correct", async () => {
          await transaction.follow.create({ data: { followerId: reader.userId, followId: author.userId } });
          assert.equal((await transaction.user.findUnique({ where: { userId: author.userId }, select: { countFollower: true } })).countFollower, 1);
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: chapter.chapterId } })).countComment, 1);
          await transaction.comment.update({ where: { commentId: comment.commentId }, data: { deletedAt: new Date() } });
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: chapter.chapterId } })).countComment, 0);
          await transaction.comment.update({ where: { commentId: comment.commentId }, data: { deletedAt: null } });
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: chapter.chapterId } })).countComment, 1);
        });
        await inner("content-only update uses exactly one chapter timestamp trigger", async () => {
          const row = await transaction.chapter.update({ where: { chapterId: chapter.chapterId }, data: { content: "Synthetic timestamp body", updatedAt: new Date("2000-01-01T00:00:00Z") } });
          const [{ now }] = await transaction.$queryRaw`SELECT transaction_timestamp() AS now`;
          assert.equal(row.updatedAt.toISOString(), now.toISOString());
          assert.equal(before.triggers.filter((trigger) => trigger.table === "chapters" && trigger.definition.includes("BEFORE UPDATE")).length, 1);
        });
        await inner("same-chapter comment constraint rejects a mismatched parent", async () => {
          await assert.rejects(transaction.comment.create({ data: { userId: reader.userId, chapterId: merged.chapterId, parentId: comment.commentId, content: "Synthetic invalid reply" } }), (error) => mapDatabaseError(error)?.status === 409);
        });
        await inner("Reading Progress keeps its novel when a chapter is deleted", async () => {
          await transaction.readingProgress.create({ data: { ...pair, chapterId: merged.chapterId, progressPercent: 0.5, scrollPosition: 120 } });
          await transaction.chapter.delete({ where: { chapterId: merged.chapterId } });
          const row = await transaction.readingProgress.findUnique({ where: { userId_novelId: pair } });
          assert.equal(row.chapterId, null); assert.equal(row.novelId, novel.novelId); assert.equal(row.scrollPosition, 120);
        });
        await inner("legacy recalc_counters still executes with chapter_likes present", async () => {
          await transaction.$executeRawUnsafe("SELECT public.recalc_counters()");
        });
        await inner("all five Forum RLS tables deny rows to a non-owner read role", async () => {
          assert.equal((await transaction.$queryRaw`SELECT rolbypassrls FROM pg_roles WHERE rolname='pg_read_all_data'`)[0].rolbypassrls, false);
          assert.equal(await transaction.forumPost.count(), 1);
          await transaction.$executeRawUnsafe("SET LOCAL ROLE pg_read_all_data");
          for (const name of forumTables) assert.equal((await transaction.$queryRawUnsafe(`SELECT count(*)::integer AS count FROM public.${name}`))[0].count, 0);
        });
        await inner("Forum RLS rejects a write even with builtin write privileges", async () => {
          await transaction.$executeRawUnsafe("SET LOCAL ROLE pg_write_all_data");
          await assert.rejects(transaction.$executeRaw`INSERT INTO public.forum_reaction(user_id,post_id) VALUES(${author.userId},${post.postId})`, (error) => mapDatabaseError(error)?.diagnostic.sqlState === "42501");
        });
        throw rollback;
      }, { timeout: 45_000, maxWait: 5_000 });
    } catch (error) { if (error !== rollback) throw error; }

    let retries = 0;
    await caseTest("concurrent legacy/modern writers remain atomic; retry a deadlock victim safely", async () => {
      const right = await pool.connect();
      try {
        assert.equal((await audit.query("SELECT count(*)::integer AS count FROM public.users WHERE user_id=-240911")).rows[0].count, 0);
        await audit.query("BEGIN");
        await audit.query("INSERT INTO public.users(user_id,username,email,password_hash) OVERRIDING SYSTEM VALUE VALUES(-240911,'be024_concurrent','be024-concurrent@example.invalid','BE024_SYNTHETIC_HASH_ONLY')");
        await audit.query("INSERT INTO public.novels(novel_id,author_id,title,slug) OVERRIDING SYSTEM VALUE VALUES(-240921,-240911,'BE024 concurrency fixture','be024-concurrency-fixture')");
        await audit.query("INSERT INTO public.chapters(chapter_id,novel_id,chapter_number,title,content) OVERRIDING SYSTEM VALUE VALUES(-240931,-240921,1,'BE024 concurrent chapter','Synthetic initial body')");
        await audit.query("COMMIT");
        await audit.query("BEGIN"); await right.query("BEGIN");
        for (const connection of [audit, right]) await connection.query("SET LOCAL lock_timeout='4s'");
        await audit.query("SELECT chapter_id FROM public.chapters WHERE chapter_id=-240931 FOR UPDATE");
        await right.query("SELECT chapter_id FROM public.chapter_contents WHERE chapter_id=-240931 FOR UPDATE");
        const writes = [
          [audit, "UPDATE public.chapters SET content='Synthetic modern concurrent' WHERE chapter_id=-240931"],
          [right, "UPDATE public.chapter_contents SET content='Synthetic legacy concurrent' WHERE chapter_id=-240931"],
        ];
        const outcomes = await Promise.all(writes.map(async ([connection, sql]) => {
          try { await connection.query(sql); await connection.query("COMMIT"); return true; }
          catch (error) {
            await connection.query("ROLLBACK");
            if (!["40P01", "40001", "55P03"].includes(error.code)) throw error;
            return false;
          }
        }));
        for (let i = 0; i < outcomes.length; i++) if (!outcomes[i]) {
          retries++;
          await writes[i][0].query("BEGIN"); await writes[i][0].query(writes[i][1]); await writes[i][0].query("COMMIT");
        }
        assert.ok(retries >= 1);
        const [{ equal }] = (await audit.query("SELECT convert_to(c.content,'UTF8')=convert_to(cc.content,'UTF8') AS equal FROM public.chapters c JOIN public.chapter_contents cc USING(chapter_id) WHERE c.chapter_id=-240931")).rows;
        assert.equal(equal, true);
      } finally {
        await audit.query("ROLLBACK"); await right.query("ROLLBACK");
        await audit.query("DELETE FROM public.novels WHERE novel_id=-240921 AND author_id=-240911 AND slug='be024-concurrency-fixture'");
        await audit.query("DELETE FROM public.users WHERE user_id=-240911 AND username='be024_concurrent' AND email='be024-concurrent@example.invalid'");
        right.release();
      }
    });
    await caseTest("original data and schema metadata remain preserved after all test fixtures", async () => {
      const after = await catalog(audit);
      assert.deepEqual(withoutSequenceValues(after), withoutSequenceValues(before));
      assert.deepEqual(await dataSignatures(audit, before.columns), signatures);
      assert.deepEqual(await rowCounts(audit), legacyCounts);
      for (const name of forumTables) assert.equal((await audit.query(`SELECT count(*)::integer AS count FROM public.${name}`)).rows[0].count, 0);
      assert.equal((await contentSummary(audit)).mismatches, 0);
      assert.equal((await audit.query("SELECT count(*)::integer AS count FROM public.novels n LEFT JOIN public.interact_novel i USING(novel_id) WHERE i.novel_id IS NULL")).rows[0].count, 1);
      assert.equal(await readFile(new URL("../../database/schema.sql", import.meta.url), "utf8"), sourceSql);
      assert.equal(await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"), mainSchema);
      const sequences = after.sequences.map((sequence) => ({
        name: sequence.sequencename,
        before: before.sequences.find((old) => old.sequencename === sequence.sequencename).last_value,
        after: sequence.last_value,
      }));
      await mkdir(new URL("../.local/", import.meta.url), { recursive: true });
      await writeFile(new URL("../.local/be02_4-tests.json", import.meta.url), `${JSON.stringify({
        target: "127.0.0.1:5432/novely_restore_test", originalDataPreserved: true,
        originalCounts: legacyCounts, noFixturesRemain: true, chapterContentMismatches: 0,
        tables: after.tables.length, indexes: after.indexes.length, triggers: after.triggers.length,
        triggerFunctions: after.functions.length, sequences, concurrentRetries: retries,
        localRlsDenialVerified: true, supabaseRoleGrantsNotVerified: true,
        postgresql17ExecutionNotVerified: true, completedAt: new Date().toISOString(),
      }, null, 2)}\n`);
    });
  } catch (error) { throw safe(error); }
});
