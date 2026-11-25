import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parseDatabaseConfig } from "../src/config/database.js";

const localUrl = "postgresql://postgres:unit_only_password@127.0.0.1:5432/novely_reconcile_test?schema=public";

test("database config keeps the accepted local target and uses a bounded pool", () => {
  const config = parseDatabaseConfig({ DATABASE_URL: localUrl });
  assert.equal(config.schema, "public");
  assert.equal(config.pool.max, 5);
  assert.equal(config.pool.connectionTimeoutMillis, 5_000);
  assert.equal(config.pool.idleTimeoutMillis, 10_000);
  assert.equal(config.pool.statement_timeout, 15_000);
  assert.equal(config.pool.options, "-c timezone=UTC");
  assert.ok(!config.pool.connectionString.includes("?schema="));
  assert.ok(Object.isFrozen(config));
  assert.ok(Object.isFrozen(config.pool));
});

test("postgres alias, default port and percent-encoded credentials are accepted", () => {
  const url = "postgres://postgres:unit%40password@127.0.0.1/novely_reconcile_test";
  assert.equal(parseDatabaseConfig({ DATABASE_URL: url }).url, url);
});

for (const [name, value] of [
  ["missing URL", undefined], ["malformed URL", "private_invalid_value"],
  ["non-PostgreSQL protocol", localUrl.replace("postgresql:", "https:")],
  ["cloud host", localUrl.replace("127.0.0.1", "example.supabase.invalid")],
  ["different local database", localUrl.replace("novely_reconcile_test", "novely_test")],
  ["default postgres database", localUrl.replace("novely_reconcile_test", "postgres")],
  ["different port", localUrl.replace(":5432/", ":6543/")],
  ["missing database", "postgresql://postgres:unit_only_password@127.0.0.1:5432/"],
  ["missing username", "postgresql://:unit_only_password@127.0.0.1:5432/novely_reconcile_test"],
  ["missing password", "postgresql://postgres@127.0.0.1:5432/novely_reconcile_test"],
  ["alternate schema", localUrl.replace("schema=public", "schema=private")],
  ["duplicate schema option", `${localUrl}&schema=public`],
  ["unapproved URL option", `${localUrl}&options=ignored`],
  ["URL fragment", `${localUrl}#private_fragment`],
  ["malformed password encoding", localUrl.replace("unit_only_password", "%ZZ")],
]) {
  test(`database config rejects ${name} without echoing secrets`, () => {
    assert.throws(() => parseDatabaseConfig({ DATABASE_URL: value }), (error) => {
      assert.ok(!error.message.includes("unit_only_password"));
      assert.ok(!error.message.includes("private_invalid_value"));
      assert.ok(!error.message.includes("private_fragment"));
      assert.ok(!error.message.includes("postgresql://"));
      return true;
    });
  });
}

test("database import and idle disconnect do not read database configuration", () => {
  const moduleUrl = new URL("../src/database/prisma.js", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e",
    `const {disconnectDatabase}=await import(${JSON.stringify(moduleUrl)}); await disconnectDatabase(); console.log('LAZY PASS');`], {
    env: { ...process.env, DATABASE_URL: "invalid_unit_configuration" },
    encoding: "utf8", timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /LAZY PASS/);
});
