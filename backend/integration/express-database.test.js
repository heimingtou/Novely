import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { loadDatabaseConfig } from "../src/config/database.js";
import { disconnectDatabase, getPrisma } from "../src/database/prisma.js";
import { createTransactionRunner } from "../src/database/transaction.js";
import { createBookshelfRepository } from "../src/modules/library/bookshelf.repository.js";
import { mapDatabaseError } from "../src/shared/errors/database-error.js";
import { baselinePath, digest, readCatalog, readRowCounts, sqlSchemaPath, verifyTarget } from "../scripts/lib/catalog.js";
import { close, listen } from "../tests/helpers/http.js";
import { cleanupCommitParents, commitIds, countersAreConsistent, ids, insertCommitParents, insertFixtures, isolatedCase } from "./helpers/be02_3-fixtures.js";
import { createFailingTestClient } from "./helpers/connection-failure.js";
import { createDatabaseHarness } from "./helpers/http-database-harness.js";

const lockId = 230003;
const config = loadConfig({ NODE_ENV: "test" });
const prismaSchemaPath = new URL("../prisma/schema.prisma", import.meta.url);

function protect(error) {
  if (error instanceof assert.AssertionError) return error;
  const mapped = mapDatabaseError(error);
  return new Error(`BE02.3 database operation failed; details hidden. ${JSON.stringify(mapped?.diagnostic ?? {})}`);
}

test("BE02.3 Express, repository, transaction and PostgreSQL integration", { timeout: 90_000 }, async (context) => {
  let prisma;
  let auditPool;
  let audit;
  let locked = false;
  let ownsFixtures = false;
  let failing;
  const servers = [];
  const logged = [];
  const logger = { error: (...args) => logged.push(args) };
  context.after(async () => {
    try {
      for (const server of servers) if (server.listening) await close(server);
      if (ownsFixtures) await cleanupCommitParents(prisma);
      await failing?.dispose();
    } finally {
      await disconnectDatabase();
      if (locked) await audit.query("SELECT pg_catalog.pg_advisory_unlock($1)", [lockId]);
      audit?.release();
      await auditPool?.end();
    }
  });

  let before;
  let rowsBefore;
  let sqlHash;
  let prismaHash;
  try {
    const databaseConfig = loadDatabaseConfig();
    auditPool = new pg.Pool({ ...databaseConfig.pool, max: 1, application_name: "novely-be02.3-audit" });
    auditPool.on("error", () => {});
    audit = await auditPool.connect();
    const query = async (sql) => (await audit.query(sql)).rows;
    await verifyTarget(query);
    [{ locked }] = await query(`SELECT pg_catalog.pg_try_advisory_lock(${lockId}) AS locked`);
    assert.equal(locked, true, "Another BE02.3 writer is running; stop instead of sharing fixtures");
    before = await readCatalog(query);
    const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
    assert.equal(digest(before), baseline.fingerprint, "Catalog must match accepted BE02.2 baseline");
    rowsBefore = await readRowCounts(query);
    assert.ok(Object.values(rowsBefore).every((count) => count === "0"), "STOP: write suite requires all 19 Local tables empty");
    sqlHash = digest(await readFile(sqlSchemaPath, "utf8"));
    prismaHash = digest(await readFile(prismaSchemaPath, "utf8"));
    prisma = await getPrisma();
    ownsFixtures = true;
  } catch (error) { throw protect(error); }

  const query = async (sql, values) => {
    try { return (await audit.query(sql, values)).rows; } catch (error) { throw protect(error); }
  };
  const run = createTransactionRunner({ getClient: async () => prisma });
  const repository = createBookshelfRepository({ getClient: () => { throw new Error("Repository escaped its supplied transaction"); } });

  await context.test("production readiness reaches Local PostgreSQL and liveness stays unchanged", async () => {
    const fixture = await listen(createApp({ config, logger, getClient: async () => prisma }));
    servers.push(fixture.server);
    const live = await fetch(`${fixture.baseUrl}/api/v1/health`);
    assert.equal(live.status, 200);
    assert.equal((await live.json()).data.database, undefined);
    const ready = await fetch(`${fixture.baseUrl}/api/v1/health/ready`);
    assert.equal(ready.status, 200);
    assert.equal(ready.headers.get("cache-control"), "no-store");
    assert.deepEqual(await ready.json(), { data: { status: "ready", service: "novely-backend" } });
    await close(fixture.server);
  });

  let connectionError;
  await context.test("real adapter connection failure maps from nested SQLSTATE 28P01", async () => {
    failing = await createFailingTestClient();
    try { await failing.client.$queryRaw`SELECT 1::integer AS ok`; } catch (error) { connectionError = error; }
    assert.ok(connectionError, "Expected an authentication failure on the same Local database");
    assert.equal(mapDatabaseError(connectionError).status, 503);
    assert.equal(mapDatabaseError(connectionError).diagnostic.sqlState, "28P01");
  });
  await context.test("production readiness gives safe 503 for a real failed connection", async () => {
    assert.ok(failing);
    const fixture = await listen(createApp({ config, logger, getClient: async () => failing.client }));
    servers.push(fixture.server);
    const response = await fetch(`${fixture.baseUrl}/api/v1/health/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: { code: "DATABASE_UNAVAILABLE", message: "Cơ sở dữ liệu chưa sẵn sàng." } });
    await close(fixture.server);
  });

  try {
    await context.test("multiple repository operations commit atomically and become visible to another connection", async () => {
      try {
        const result = await run(async (transaction) => {
          await insertCommitParents(transaction);
          await repository.create({ userId: commitIds.reader, novelId: commitIds.novel }, { transaction });
          await repository.updateStatus(commitIds.reader, commitIds.novel, "reading", { transaction });
          await transaction.novelLike.create({ data: { userId: commitIds.reader, novelId: commitIds.novel } });
          await transaction.follow.create({ data: { followerId: commitIds.reader, followId: commitIds.author } });
          const [{ count }] = await query("SELECT count(*)::integer AS count FROM public.bookshelves WHERE user_id=$1 AND novel_id=$2", [commitIds.reader, commitIds.novel]);
          assert.equal(count, 0, "Uncommitted writes must be invisible outside the transaction");
          return repository.find(commitIds.reader, commitIds.novel, { transaction });
        });
        assert.equal(result.readingStatus, "reading");
        const [stored] = await query("SELECT b.reading_status,n.count_like FROM public.bookshelves b JOIN public.novels n USING(novel_id) WHERE b.user_id=$1 AND b.novel_id=$2", [commitIds.reader, commitIds.novel]);
        assert.deepEqual(stored, { reading_status: "reading", count_like: 1 });
        assert.equal(await countersAreConsistent(prisma), true);
      } catch (error) { throw protect(error); }
    });

    await context.test("a failing repository operation rolls back every write and trigger counter", async () => {
      await assert.rejects(run(async (transaction) => {
        await transaction.novelLike.create({ data: { userId: commitIds.author, novelId: commitIds.novel } });
        await transaction.follow.create({ data: { followerId: commitIds.author, followId: commitIds.reader } });
        await repository.updateStatus(commitIds.reader, commitIds.novel, "completed", { transaction });
        await repository.create({ userId: commitIds.reader, novelId: commitIds.novel }, { transaction });
      }), (error) => error.code === "P2002");
      const [stored] = await query("SELECT b.reading_status,n.count_like FROM public.bookshelves b JOIN public.novels n USING(novel_id) WHERE b.user_id=$1 AND b.novel_id=$2", [commitIds.reader, commitIds.novel]);
      assert.deepEqual(stored, { reading_status: "reading", count_like: 1 });
      assert.equal(await prisma.follow.count(), 1);
      assert.equal(await prisma.novelLike.count(), 1);
      assert.equal(await countersAreConsistent(prisma), true);
    });
  } finally {
    await cleanupCommitParents(prisma);
  }
  await context.test("committed fixtures are removed only by reserved IDs plus synthetic ownership markers", async () => {
    assert.deepEqual(await readRowCounts(query), rowsBefore);
  });

  const rollback = new Error("BE023_FIXTURE_ROLLBACK");
  try {
    await run(async (transaction) => {
      await insertFixtures(transaction);
      assert.equal(await countersAreConsistent(transaction), true);
      const options = { transaction };
      const pair = { userId: ids.reader, novelId: ids.novel };
      const operations = {
        unique: async () => { await repository.create(pair, options); return repository.create(pair, options); },
        foreignKey: () => repository.create({ userId: -230199, novelId: ids.novel }, options),
        notFound: () => repository.updateStatus(ids.reader, ids.novel, "reading", options),
        check: () => repository.create({ ...pair, readingStatus: "invalid_state" }, options),
        restrict: () => transaction.user.delete({ where: { userId: ids.author } }),
        unexpected: () => transaction.$queryRaw`SELECT 1/0 AS impossible`,
        connection: async () => { throw connectionError; },
        serialize: async () => ({
          ...await transaction.comment.findUnique({ where: { commentId: ids.comment },
            select: { commentId: true, parentId: true, createdAt: true, user: { select: { userId: true, username: true, passwordHash: true } } } }),
          password_hash: "BE023_SYNTHETIC_HASH_ONLY",
        }),
      };
      const http = await listen(createDatabaseHarness({ repository, transaction, operations, logger }));
      const request = (path, { method = "GET", body } = {}) => fetch(`${http.baseUrl}/__be023${path}`, {
        method, headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const caseTest = (name, work) => context.test(name, async () => {
        try {
          await isolatedCase(transaction, work);
          assert.equal(await countersAreConsistent(transaction), true, "Counters remain consistent after case rollback");
        } catch (error) { throw protect(error); }
      });
      try {
        await caseTest("HTTP Create/Read/Update/Delete uses controller, service, repository and the supplied transaction", async () => {
          const created = await request("/bookshelf", { method: "POST", body: pair });
          assert.equal(created.status, 201);
          const initial = (await created.json()).data;
          assert.equal(initial.readingStatus, "plan_to_read");
          assert.equal(initial.novel.novelId, ids.novel);
          assert.deepEqual(initial.user, { userId: ids.reader, username: "be023_reader" });
          assert.ok(Number.isFinite(Date.parse(initial.savedAt)));
          const path = `/bookshelf/${ids.reader}/${ids.novel}`;
          const read = await request(path);
          assert.equal(read.status, 200);
          assert.equal((await read.json()).data.userId, ids.reader);
          const updated = await request(path, { method: "PATCH", body: { readingStatus: "reading" } });
          assert.equal(updated.status, 200);
          assert.equal((await updated.json()).data.readingStatus, "reading");
          assert.equal((await request(path, { method: "DELETE" })).status, 200);
          assert.equal((await request(path)).status, 404);
          assert.equal(await transaction.bookshelf.count(), 0);
          assert.deepEqual(await readRowCounts(query), rowsBefore, "HTTP work never escapes the rollback transaction");
        });

        for (const [name, status, code] of [
          ["unique", 409, "UNIQUE_CONSTRAINT"], ["foreignKey", 409, "FOREIGN_KEY_CONSTRAINT"],
          ["notFound", 404, "RECORD_NOT_FOUND"], ["check", 422, "CHECK_CONSTRAINT"],
          ["restrict", 409, "FOREIGN_KEY_CONSTRAINT"], ["unexpected", 500, "INTERNAL_ERROR"],
          ["connection", 503, "DATABASE_UNAVAILABLE"],
        ]) {
          await caseTest(`real database error ${name} becomes safe HTTP ${status}`, async () => {
            const response = await request(`/operation/${name}`, { method: "POST" });
            assert.equal(response.status, status);
            const text = await response.text();
            assert.equal(JSON.parse(text).error.code, code);
            for (const privateValue of ["BE023_SYNTHETIC_HASH_ONLY", "postgresql://", "SELECT", "password_hash", "driverAdapterError"]) assert.ok(!text.includes(privateValue));
          });
        }
        await caseTest("HTTP serialization preserves real PostgreSQL BigInt, Date and null while stripping hashes", async () => {
          const response = await request("/operation/serialize", { method: "POST" });
          assert.equal(response.status, 200);
          const text = await response.text();
          const data = JSON.parse(text).data;
          assert.equal(data.commentId, ids.comment.toString());
          assert.equal(data.parentId, null);
          assert.ok(Number.isFinite(Date.parse(data.createdAt)));
          assert.equal(data.user.passwordHash, undefined);
          assert.ok(!text.includes("BE023_SYNTHETIC_HASH_ONLY"));
          assert.ok(!text.includes("password_hash"));
        });
        await caseTest("the transaction runner can reuse an existing transaction without a root client", async () => {
          const reuse = createTransactionRunner({ getClient: () => { throw new Error("Unexpected nested transaction"); } });
          await reuse(async (client) => {
            assert.equal(client, transaction);
            await repository.create(pair, { transaction: client });
            assert.equal((await repository.find(pair.userId, pair.novelId, { transaction: client })).readingStatus, "plan_to_read");
          }, { transaction });
        });
        await caseTest("all four Library statuses work through the reference repository", async () => {
          await repository.create(pair, options);
          for (const status of ["plan_to_read", "reading", "completed", "dropped"]) {
            assert.equal((await repository.updateStatus(pair.userId, pair.novelId, status, options)).readingStatus, status);
          }
        });
        await caseTest("composite primary key prevents duplicate Library rows", async () => {
          await repository.create(pair, options);
          await assert.rejects(repository.create(pair, options), (error) => error.code === "P2002");
        });
        await caseTest("ReadingProgress reads a same-novel chapter through its composite foreign key", async () => {
          await transaction.readingProgress.create({ data: { ...pair, chapterId: ids.chapter, progressPercent: 0.5, scrollPosition: 120 } });
          const row = await transaction.readingProgress.findUnique({ where: { userId_novelId: pair }, include: { chapter: true, novel: true } });
          assert.equal(row.chapter.novelId, row.novelId);
          assert.equal(row.progressPercent, 0.5);
          assert.equal(row.scrollPosition, 120);
        });
        await caseTest("ReadingProgress rejects a chapter belonging to another novel", async () => {
          await assert.rejects(transaction.readingProgress.create({ data: { ...pair, chapterId: ids.otherChapter } }), (error) => error.code === "P2003");
        });
        await caseTest("chapter reply rejects a parent from another chapter", async () => {
          await assert.rejects(transaction.comment.update({ where: { commentId: ids.reply }, data: { parentId: ids.otherComment } }), (error) => error.code === "P2003");
        });
        await caseTest("Forum reply rejects a parent from another post", async () => {
          await assert.rejects(transaction.forumComment.update({ where: { commentId: ids.forumReply }, data: { parentId: ids.otherForumComment } }), (error) => error.code === "P2003");
        });
        await caseTest("chapter number stays unique within each novel", async () => {
          await assert.rejects(transaction.chapter.update({ where: { chapterId: ids.secondChapter }, data: { chapterNumber: 1 } }), (error) => error.code === "P2002");
        });
        await caseTest("Prisma relation queries retain BigInt comment IDs without precision loss", async () => {
          const row = await transaction.comment.findUnique({ where: { commentId: ids.comment }, include: { replies: true, chapter: true } });
          assert.equal(typeof row.commentId, "bigint");
          assert.equal(row.replies[0].parentId, ids.comment);
          assert.equal(row.chapter.novelId, ids.novel);
        });
        await caseTest("NovelLike create/update/delete maintains count_like once", async () => {
          const key = { userId_novelId: pair };
          await transaction.novelLike.create({ data: pair });
          assert.equal((await transaction.novel.findUnique({ where: { novelId: ids.novel } })).countLike, 1);
          await transaction.novelLike.update({ where: key, data: { novelId: ids.otherNovel } });
          assert.equal((await transaction.novel.findUnique({ where: { novelId: ids.novel } })).countLike, 0);
          assert.equal((await transaction.novel.findUnique({ where: { novelId: ids.otherNovel } })).countLike, 1);
          await transaction.novelLike.delete({ where: { userId_novelId: { userId: ids.reader, novelId: ids.otherNovel } } });
          assert.equal(await countersAreConsistent(transaction), true);
        });
        await caseTest("Follow create/update/delete maintains both follow counters once", async () => {
          await transaction.follow.create({ data: { followerId: ids.reader, followId: ids.author } });
          assert.equal((await transaction.user.findUnique({ where: { userId: ids.reader } })).countFollowing, 1);
          assert.equal((await transaction.user.findUnique({ where: { userId: ids.author } })).countFollower, 1);
          await transaction.follow.update({ where: { followerId_followId: { followerId: ids.reader, followId: ids.author } }, data: { followId: ids.otherUser } });
          assert.equal((await transaction.user.findUnique({ where: { userId: ids.author } })).countFollower, 0);
          assert.equal((await transaction.user.findUnique({ where: { userId: ids.otherUser } })).countFollower, 1);
          await transaction.follow.delete({ where: { followerId_followId: { followerId: ids.reader, followId: ids.otherUser } } });
          assert.equal(await countersAreConsistent(transaction), true);
        });
        await caseTest("Comment INSERT through Prisma SQL and model DELETE update active comment count", async () => {
          await transaction.$executeRaw`INSERT INTO public.comments(comment_id,user_id,chapter_id,content) OVERRIDING SYSTEM VALUE VALUES(${ids.newComment},${ids.reader},${ids.chapter},'BE023 new synthetic comment')`;
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: ids.chapter } })).countComment, 3);
          assert.equal((await transaction.comment.findUnique({ where: { commentId: ids.newComment } })).commentId, ids.newComment);
          await transaction.comment.delete({ where: { commentId: ids.newComment } });
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: ids.chapter } })).countComment, 2);
        });
        await caseTest("comment soft delete and restore count only active rows and preserve replies", async () => {
          await transaction.comment.update({ where: { commentId: ids.comment }, data: { deletedAt: new Date() } });
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: ids.chapter } })).countComment, 1);
          assert.ok(await transaction.comment.findUnique({ where: { commentId: ids.reply } }));
          await transaction.comment.update({ where: { commentId: ids.comment }, data: { deletedAt: null } });
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: ids.chapter } })).countComment, 2);
          assert.equal(await countersAreConsistent(transaction), true);
        });
        await caseTest("moving an unparented comment transfers its count between chapters", async () => {
          await transaction.comment.update({ where: { commentId: ids.otherComment }, data: { chapterId: ids.chapter } });
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: ids.chapter } })).countComment, 3);
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: ids.otherChapter } })).countComment, 0);
          assert.equal(await countersAreConsistent(transaction), true);
        });

        for (const [model, where] of [
          ["user", { userId: ids.reader }], ["novel", { novelId: ids.novel }],
          ["chapter", { chapterId: ids.chapter }], ["comment", { commentId: ids.comment }],
          ["review", { reviewId: ids.review }], ["forumPost", { postId: ids.post }],
          ["forumComment", { commentId: ids.forumComment }], ["bookshelf", { userId_novelId: pair }],
        ]) {
          await caseTest(`PostgreSQL updated_at trigger overrides stale values through Prisma ${model}`, async () => {
            if (model === "bookshelf") await repository.create(pair, options);
            const updated = await transaction[model].update({ where, data: { updatedAt: new Date("2000-01-01T00:00:00.000Z") } });
            const [{ now }] = await transaction.$queryRaw`SELECT transaction_timestamp() AS now`;
            assert.equal(updated.updatedAt.toISOString(), now.toISOString());
          });
        }
        await caseTest("chapter content update touches updated_at while word_count stays service-owned", async () => {
          const row = await transaction.chapter.update({ where: { chapterId: ids.chapter }, data: { content: "New synthetic paragraph", updatedAt: new Date("2000-01-01T00:00:00.000Z") } });
          const [{ now }] = await transaction.$queryRaw`SELECT transaction_timestamp() AS now`;
          assert.equal(row.content, "New synthetic paragraph");
          assert.equal(row.wordCount, 0);
          assert.equal(row.updatedAt.toISOString(), now.toISOString());
        });
        await caseTest("chapter DELETE SET NULL changes only chapter_id and cascades chapter comments", async () => {
          await transaction.readingProgress.create({ data: { ...pair, chapterId: ids.chapter, progressPercent: 0.5, scrollPosition: 120 } });
          await repository.create(pair, options);
          await transaction.chapter.delete({ where: { chapterId: ids.chapter } });
          const row = await transaction.readingProgress.findUnique({ where: { userId_novelId: pair } });
          assert.equal(row.chapterId, null);
          assert.equal(row.novelId, ids.novel);
          assert.equal(row.progressPercent, 0.5);
          assert.equal(row.scrollPosition, 120);
          assert.equal(await transaction.comment.count({ where: { chapterId: ids.chapter } }), 0);
          assert.ok(await repository.find(pair.userId, pair.novelId, options));
          assert.equal(await countersAreConsistent(transaction), true);
        });
        await caseTest("novel CASCADE removes reading data, chapters, comments, reviews and analytics", async () => {
          await repository.create(pair, options);
          await transaction.readingProgress.create({ data: { ...pair, chapterId: ids.chapter } });
          await transaction.novelLike.create({ data: pair });
          await transaction.novel.delete({ where: { novelId: ids.novel } });
          for (const model of ["bookshelf", "readingProgress", "novelLike", "novelGenre", "chapter", "review", "interactNovel", "interactNovelDay"]) {
            assert.equal(await transaction[model].count({ where: { novelId: ids.novel } }), 0);
          }
          assert.equal(await transaction.comment.count({ where: { chapterId: { in: [ids.chapter, ids.secondChapter] } } }), 0);
          assert.equal(await transaction.forumPost.count(), 2);
          assert.equal(await countersAreConsistent(transaction), true);
        });
        await caseTest("user CASCADE removes social/reading data and updates surviving parent counters", async () => {
          await transaction.novelLike.create({ data: { userId: ids.otherUser, novelId: ids.novel } });
          await transaction.follow.createMany({ data: [{ followerId: ids.otherUser, followId: ids.author }, { followerId: ids.reader, followId: ids.otherUser }] });
          await repository.create({ userId: ids.otherUser, novelId: ids.novel }, options);
          await transaction.readingProgress.create({ data: { userId: ids.otherUser, novelId: ids.novel, chapterId: ids.chapter } });
          await transaction.$executeRaw`INSERT INTO public.comments(comment_id,user_id,chapter_id,content,parent_id) OVERRIDING SYSTEM VALUE VALUES
            (${ids.newComment},${ids.otherUser},${ids.chapter},'Owned root',NULL),(${ids.newReply},${ids.reader},${ids.chapter},'Other user reply',${ids.newComment})`;
          await transaction.user.delete({ where: { userId: ids.otherUser } });
          assert.equal(await transaction.profile.count({ where: { userId: ids.otherUser } }), 0);
          assert.equal(await transaction.comment.count({ where: { commentId: { in: [ids.newComment, ids.newReply] } } }), 0);
          assert.equal(await transaction.novelLike.count(), 0);
          assert.equal(await transaction.follow.count(), 0);
          assert.equal(await transaction.readingProgress.count(), 0);
          assert.equal(await transaction.bookshelf.count(), 0);
          assert.equal(await countersAreConsistent(transaction), true);
        });
        await caseTest("parent comment CASCADE deletes its replies and decrements both active rows", async () => {
          await transaction.comment.delete({ where: { commentId: ids.comment } });
          assert.equal(await transaction.comment.count({ where: { commentId: { in: [ids.comment, ids.reply] } } }), 0);
          assert.equal((await transaction.chapter.findUnique({ where: { chapterId: ids.chapter } })).countComment, 0);
        });
        await caseTest("genre RESTRICT blocks deletion while a novel uses the genre", async () => {
          await assert.rejects(transaction.genre.delete({ where: { genreId: ids.genre } }), (error) => mapDatabaseError(error)?.diagnostic.sqlState === "23001");
        });
        await caseTest("Forum post NO ACTION blocks hard delete with dependent data", async () => {
          await assert.rejects(transaction.forumPost.delete({ where: { postId: ids.post } }), (error) => error.code === "P2003");
        });
        await caseTest("Forum comment NO ACTION retains a parent that has replies", async () => {
          await assert.rejects(transaction.forumComment.delete({ where: { commentId: ids.forumComment } }), (error) => error.code === "P2003");
        });
        await caseTest("Forum reaction composite key supports create, update and delete", async () => {
          const key = { userId: ids.reader, postId: ids.post };
          await transaction.forumReaction.create({ data: { ...key, reactionType: "like" } });
          const updated = await transaction.forumReaction.update({ where: { userId_postId: key }, data: { reactionType: "love" } });
          assert.equal(updated.reactionType, "love");
          await transaction.forumReaction.delete({ where: { userId_postId: key } });
          assert.equal(await transaction.forumReaction.count(), 0);
        });
      } finally {
        await close(http.server);
      }
      throw rollback;
    }, { timeout: 45_000, maxWait: 5_000 });
  } catch (error) { if (error !== rollback) throw protect(error); }

  await context.test("full metadata, source schemas, row counts and sequence state remain unchanged", async () => {
    const after = await readCatalog(query);
    assert.deepEqual(after, before);
    assert.deepEqual(await readRowCounts(query), rowsBefore);
    assert.equal(digest(await readFile(sqlSchemaPath, "utf8")), sqlHash);
    assert.equal(digest(await readFile(prismaSchemaPath, "utf8")), prismaHash);
    assert.equal(after.sequences.every((sequence) => sequence.last_value === null), true);
    const report = {
      task: "BE02.3", target: "127.0.0.1:5432/novely_reconcile_test", fingerprintBefore: digest(before), fingerprintAfter: digest(after),
      tables: after.tables.length, indexes: after.indexes.length, triggers: after.triggers.length, functions: after.functions.length,
      rows: await readRowCounts(query), sequencesChanged: false, sqlSchemaHash: sqlHash, prismaSchemaHash: prismaHash,
      capturedAt: new Date().toISOString(),
    };
    await writeFile(new URL("../.local/be02_3-result.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  });
  await context.test("database error logs contain only safe diagnostic codes", () => {
    const text = JSON.stringify(logged);
    for (const secret of ["BE023_SYNTHETIC_HASH_ONLY", "BE023_INTENTIONALLY_INVALID_AUTH_TEST", "postgresql://", "SELECT ", "password_hash"]) assert.ok(!text.includes(secret));
  });
});
