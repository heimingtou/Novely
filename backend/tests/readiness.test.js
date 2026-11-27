import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { createReadinessService } from "../src/modules/health/health.service.js";
import { close, listen } from "./helpers/http.js";

const config = loadConfig({ NODE_ENV: "test" });
const unavailable = { error: { code: "DATABASE_UNAVAILABLE", message: "Cơ sở dữ liệu chưa sẵn sàng." } };
function readyClient(calls = []) {
  return {
    async $transaction(work, options) {
      calls.push(options);
      return work({
        async $executeRaw(sql) { calls.push(sql.join("")); return 0; },
        async $queryRaw(sql) { calls.push(sql.join("")); return [{ ok: 1 }]; },
      });
    },
  };
}

test("liveness stays independent of the database, and readiness probes read-only", async (context) => {
  let accesses = 0;
  const calls = [];
  const client = readyClient(calls);
  const fixture = await listen(createApp({ config, getClient: async () => { accesses++; return client; } }));
  context.after(() => close(fixture.server));
  assert.equal(accesses, 0);
  const live = await fetch(`${fixture.baseUrl}/api/v1/health`);
  assert.equal(live.status, 200);
  assert.equal((await live.json()).data.status, "ok");
  assert.equal(accesses, 0);
  const ready = await fetch(`${fixture.baseUrl}/api/v1/health/ready`);
  assert.equal(ready.status, 200);
  assert.equal(ready.headers.get("cache-control"), "no-store");
  assert.deepEqual(await ready.json(), { data: { status: "ready", service: "novely-backend" } });
  assert.equal(accesses, 1);
  assert.deepEqual(calls[0], { maxWait: 1_000, timeout: 1_500 });
  assert.deepEqual(calls.slice(1), ["SET TRANSACTION READ ONLY", "SET LOCAL statement_timeout = '1000ms'", "SELECT 1::integer AS ok"]);
});

test("readiness returns safe 503 when database access fails", async (context) => {
  const fixture = await listen(createApp({ config, getClient: async () => {
    throw new Error("postgresql://private:secret@example.invalid/private; SELECT password_hash");
  } }));
  context.after(() => close(fixture.server));
  const response = await fetch(`${fixture.baseUrl}/api/v1/health/ready`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), unavailable);
});

test("readiness returns 503 before a stalled provider completes", async (context) => {
  let calls = 0;
  const fixture = await listen(createApp({ config, readinessTimeoutMs: 25, getClient: () => {
    calls++; return new Promise(() => {});
  } }));
  context.after(() => close(fixture.server));
  const started = performance.now();
  const responses = await Promise.all([1, 2, 3].map(() => fetch(`${fixture.baseUrl}/api/v1/health/ready`)));
  assert.ok(performance.now() - started < 1_000);
  for (const response of responses) {
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), unavailable);
  }
  assert.equal(calls, 1, "one pending probe shared across requests");
});

test("readiness recovers after a failed probe rather than caching failure", async () => {
  let calls = 0;
  const service = createReadinessService({ repository: { async checkConnection() {
    if (++calls === 1) throw new Error("unit failure");
    return true;
  } } });
  assert.equal(await service.check(), false);
  assert.equal(await service.check(), true);
  assert.equal(calls, 2);
});

test("unexpected readiness query results are treated as unavailable", async (context) => {
  const fixture = await listen(createApp({ config, getClient: async () => ({
    $transaction: (work) => work({ $executeRaw: async () => 0, $queryRaw: async () => [{ ok: 0 }] }),
  }) }));
  context.after(() => close(fixture.server));
  assert.equal((await fetch(`${fixture.baseUrl}/api/v1/health/ready`)).status, 503);
});

test("production app exposes no fixture CRUD routes or readiness write methods", async (context) => {
  const fixture = await listen(createApp({ config, getClient: async () => { assert.fail("Unexpected database access"); } }));
  context.after(() => close(fixture.server));
  for (const [path, method] of [["/api/v1/health/ready", "POST"], ["/__be023/bookshelf", "POST"], ["/api/v1/library", "POST"]]) {
    assert.equal((await fetch(`${fixture.baseUrl}${path}`, { method })).status, 404);
  }
});
