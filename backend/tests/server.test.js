import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfig } from "../src/config/env.js";
import { shutdownServer, startServer } from "../src/server.js";
import { close } from "./helpers/http.js";

const logger = { info() {}, error() {} };
const config = { ...loadConfig({ NODE_ENV: "test" }), port: 0 };

test("the server can start, serve health and shut down cleanly", async (context) => {
  const server = await startServer({ config, logger });
  context.after(async () => { if (server.listening) await close(server); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/health`);
  assert.equal(response.status, 200);
  await response.json();
  const closed = once(server, "close");
  shutdownServer(server, logger);
  await closed;
  assert.equal(server.listening, false);
});

test("starting on an occupied port fails with EADDRINUSE", async (context) => {
  const server = await startServer({ config, logger });
  context.after(() => close(server));
  await assert.rejects(startServer({ config: { ...config, port: server.address().port }, logger }), { code: "EADDRINUSE" });
});

test("the CLI fails fast on invalid configuration from the repository root", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../src/server.js", import.meta.url))], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    env: { ...process.env, NODE_ENV: "test", PORT: "invalid", CORS_ORIGINS: "http://localhost:3000" },
    encoding: "utf8", timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Startup failed: PORT/);
  assert.ok(!result.stdout.includes("Listening"));
});
