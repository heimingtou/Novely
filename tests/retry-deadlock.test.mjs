import assert from "node:assert/strict";
import test from "node:test";
import { retryDeadlockedQuery } from "../src/server/retry-deadlock.mjs";

test("returns a successful statement without retry", async () => {
  const result = { data: { id: 1 }, error: null };
  let calls = 0;
  assert.equal(await retryDeadlockedQuery(() => { calls++; return result; }), result);
  assert.equal(calls, 1);
});

test("retries returned SQLSTATE 40P01 with a fresh query, at most three attempts", async () => {
  let calls = 0;
  const result = await retryDeadlockedQuery(() => {
    const attempt = ++calls;
    // A consumed thenable must not be awaited again instead of being recreated.
    let consumed = false;
    return { then(resolve) {
      assert.equal(consumed, false);
      consumed = true;
      resolve(attempt < 3 ? { error: { code: "40P01" } } : { data: 3, error: null });
    } };
  });
  assert.deepEqual(result, { data: 3, error: null });
  assert.equal(calls, 3);
});

test("returns the final deadlock error unchanged after two retries", async () => {
  const results = Array.from({ length: 3 }, () => ({ data: null, error: { code: "40P01" } }));
  let calls = 0;
  assert.equal(await retryDeadlockedQuery(() => results[calls++]), results[2]);
  assert.equal(calls, 3);
});

test("handles a thrown confirmed deadlock and preserves its identity when exhausted", async () => {
  const failure = Object.assign(new Error("Synthetic deadlock"), { code: "40P01" });
  let calls = 0;
  await assert.rejects(retryDeadlockedQuery(() => { calls++; throw failure; }), (error) => error === failure);
  assert.equal(calls, 3);
});

for (const code of ["23505", "23503", "23514", "40001", "55P03", "57014", "42501", "PGRST201", "500", ""]) {
  test(`does not retry returned ${code || "network/unknown"} errors`, async () => {
    let calls = 0;
    const result = { data: null, error: { code } };
    assert.equal(await retryDeadlockedQuery(() => { calls++; return result; }), result);
    assert.equal(calls, 1);
  });
}

test("does not retry an ambiguous thrown fetch failure", async () => {
  const failure = new TypeError("Synthetic fetch failure");
  let calls = 0;
  await assert.rejects(retryDeadlockedQuery(() => { calls++; throw failure; }), (error) => error === failure);
  assert.equal(calls, 1);
});
