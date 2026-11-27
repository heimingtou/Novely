import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { createErrorHandler } from "../src/middlewares/error-handler.js";
import { ApiError } from "../src/shared/errors/api-error.js";
import { close, listen } from "./helpers/http.js";

let server;
let baseUrl;
const errors = [];
const logger = { error: (...args) => errors.push(args) };

before(async () => {
  ({ server, baseUrl } = await listen(createApp({ config: loadConfig({ NODE_ENV: "test" }), logger })));
});
after(async () => close(server));

test("GET /api/v1/health reports a live Express process", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-powered-by"), null);
  const body = await response.json();
  assert.equal(body.data.status, "ok");
  assert.equal(body.data.service, "novely-backend");
  assert.ok(Number.isFinite(Date.parse(body.data.timestamp)));
  assert.ok(Number.isInteger(body.data.uptime) && body.data.uptime >= 0);
  assert.equal(body.data.database, undefined);
});

test("unknown paths return the existing API error envelope as JSON", async () => {
  const response = await fetch(`${baseUrl}/api/v1/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { code: "NOT_FOUND", message: "Không tìm thấy đường dẫn API." } });
});

test("the existing Next.js /api/health path is not taken over", async () => {
  assert.equal((await fetch(`${baseUrl}/api/health`)).status, 404);
});

test("unsupported health methods return JSON 404", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, { method: "POST" });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "NOT_FOUND");
});

for (const origin of loadConfig({}).corsOrigins) {
  test(`CORS allows configured origin ${origin}`, async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, { headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.match(response.headers.get("vary"), /Origin/);
  });
}

test("CORS rejects an unconfigured origin before routing", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, { headers: { Origin: "https://untrusted.example" } });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal((await response.json()).error.code, "CORS_ORIGIN_DENIED");
});

test("CORS handles a browser preflight request", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "content-type" },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.match(response.headers.get("access-control-allow-methods"), /GET/);
  assert.match(response.headers.get("access-control-allow-headers"), /content-type/i);
});

test("CORS rejects preflight from an unconfigured origin", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    method: "OPTIONS", headers: { Origin: "https://untrusted.example", "Access-Control-Request-Method": "POST" },
  });
  assert.equal(response.status, 403);
});

test("malformed JSON is reported as 400 without echoing its contents", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: '{"private":"do-not-return",',
  });
  assert.equal(response.status, 400);
  const text = await response.text();
  assert.equal(JSON.parse(text).error.code, "INVALID_JSON");
  assert.ok(!text.includes("do-not-return"));
  assert.ok(!text.includes("stack"));
});

test("JSON larger than 100 KB is rejected as 413", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: "x".repeat(101 * 1024) }),
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, "PAYLOAD_TOO_LARGE");
});

test("unsupported JSON charset is rejected as 415", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    method: "POST", headers: { "Content-Type": "application/json; charset=iso-8859-1" }, body: "{}",
  });
  assert.equal(response.status, 415);
  assert.equal((await response.json()).error.code, "UNSUPPORTED_CHARSET");
});

test("valid JSON reaches routing and client errors do not enter the internal-error log", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valid: true }),
  });
  assert.equal(response.status, 404);
  assert.deepEqual(errors, []);
});

test("Express 5 forwards rejected async handlers to the shared error handler", async (context) => {
  // This route exists only in the test harness, never in the production API.
  const app = express();
  const logged = [];
  app.get("/failure", async () => { throw new Error("internal-detail-do-not-return"); });
  app.get("/unexpected-type", () => {
    const error = new Error("internal-detail-do-not-return");
    error.type = "constructor";
    throw error;
  });
  app.get("/expected", () => { throw new ApiError(409, "CONFLICT", "Dữ liệu đã tồn tại."); });
  app.use(createErrorHandler({ error: (...args) => logged.push(args) }));
  const fixture = await listen(app);
  context.after(() => close(fixture.server));

  const unexpected = await fetch(`${fixture.baseUrl}/failure`);
  assert.equal(unexpected.status, 500);
  assert.deepEqual(await unexpected.json(), { error: { code: "INTERNAL_ERROR", message: "Lỗi máy chủ." } });
  assert.equal(logged.length, 1);
  const expected = await fetch(`${fixture.baseUrl}/expected`);
  assert.equal(expected.status, 409);
  assert.deepEqual(await expected.json(), { error: { code: "CONFLICT", message: "Dữ liệu đã tồn tại." } });
  assert.equal(logged.length, 1);

  // An arbitrary error type must not resolve a property inherited from Object.
  const unexpectedType = await fetch(`${fixture.baseUrl}/unexpected-type`);
  assert.equal(unexpectedType.status, 500);
  assert.equal((await unexpectedType.json()).error.code, "INTERNAL_ERROR");
  assert.equal(logged.length, 2);
});
