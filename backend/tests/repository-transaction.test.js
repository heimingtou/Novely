import assert from "node:assert/strict";
import test from "node:test";
import { createTransactionRunner } from "../src/database/transaction.js";
import { createBookshelfRepository } from "../src/modules/library/bookshelf.repository.js";

test("transaction runner injects the transaction client and caller options", async () => {
  const transaction = { marker: "transaction-client" };
  let options;
  const run = createTransactionRunner({ getClient: async () => ({
    $transaction: async (work, value) => { options = value; return work(transaction); },
  }) });
  const result = await run(async (client) => { assert.equal(client, transaction); return 42; }, { isolationLevel: "Serializable", timeout: 3_000 });
  assert.equal(result, 42);
  assert.deepEqual(options, { maxWait: 2_000, timeout: 3_000, isolationLevel: "Serializable" });
});

test("reusing a transaction never fetches the root client or starts a nested transaction", async () => {
  const transaction = {};
  const run = createTransactionRunner({ getClient: () => { assert.fail("Root client accessed"); } });
  assert.equal(await run(async (client) => client, { transaction }), transaction);
});

test("transaction errors propagate unchanged so Prisma can roll back and middleware can classify", async () => {
  const original = Object.assign(new Error("unit failure"), { code: "P2002" });
  const run = createTransactionRunner({ getClient: async () => ({ $transaction: (work) => work({}) }) });
  await assert.rejects(run(async () => { throw original; }), (error) => error === original);
  await assert.rejects(run(null), TypeError);
});

test("repository honors an explicit transaction and projects only public relation fields", async () => {
  let requested;
  const transaction = { bookshelf: { async findUnique(options) { requested = options; return null; } } };
  const repository = createBookshelfRepository({ getClient: () => { assert.fail("Root client accessed"); } });
  assert.equal(await repository.find(101, 1001, { transaction }), null);
  assert.deepEqual(requested.where, { userId_novelId: { userId: 101, novelId: 1001 } });
  assert.deepEqual(Object.keys(requested.select.user.select).sort(), ["userId", "username"]);
  assert.ok(!JSON.stringify(requested).includes("password"));
});

test("repository writes only whitelisted Library fields and leaves counters to PostgreSQL", async () => {
  let data;
  const repository = createBookshelfRepository({ getClient: async () => ({ bookshelf: {
    async create(options) { data = options.data; return { ...data }; },
  } }) });
  await repository.create({ userId: 101, novelId: 1001, countLike: 999, passwordHash: "unit_private" });
  assert.deepEqual(data, { userId: 101, novelId: 1001, readingStatus: "plan_to_read" });
});
