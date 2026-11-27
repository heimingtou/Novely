import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { rootCertificates } from "node:tls";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { parseDatabaseConfig } from "../src/config/database.js";
import { verifySupabaseConnection } from "../src/database/verify-supabase.js";

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

const projectRef = "abcdefghijklmnopqrst";
const approvedHost = "aws-0-ap-southeast-2.pooler.supabase.com";
const cloudEnvironment = {
  DATABASE_PROFILE: "supabase",
  DATABASE_URL: `postgresql://novely_backend.${projectRef}:unit_only_password@${approvedHost}:5432/postgres?schema=public`,
  SUPABASE_PROJECT_REF: projectRef, SUPABASE_DB_HOST: approvedHost,
  SUPABASE_DB_ROLE: "novely_backend", DATABASE_CA_FILE: resolve("unit-ca.crt"),
};
const caOptions = { readCa: () => rootCertificates[0] };

test("transition Local uses the accepted generated Client without widening the Local host gate", () => {
  const config = parseDatabaseConfig({ DATABASE_PROFILE: "local-transition", DATABASE_URL: localUrl.replace("novely_reconcile_test", "novely_restore_test") });
  assert.equal(config.client, "transition");
  assert.equal(config.pool.ssl, false);
  assert.throws(() => parseDatabaseConfig({ DATABASE_PROFILE: "local-transition", DATABASE_URL: localUrl }));
});

test("Supabase requires explicit tenant routing and CA/hostname verification", () => {
  const config = parseDatabaseConfig(cloudEnvironment, caOptions);
  assert.equal(config.client, "transition");
  assert.equal(config.pool.ssl.rejectUnauthorized, true);
  assert.equal(config.pool.ssl.servername, approvedHost);
  assert.ok(config.pool.ssl.ca.includes("BEGIN CERTIFICATE"));
  assert.ok(config.pool.options.includes("default_transaction_read_only=on"));
  assert.equal(config.expectedIdentity.role, "novely_backend");
  assert.ok(Object.isFrozen(config.pool.ssl));
});

for (const [name, change] of [
  ["unknown profile", { DATABASE_PROFILE: "automatic" }],
  ["missing project", { SUPABASE_PROJECT_REF: undefined }],
  ["unapproved host", { SUPABASE_DB_HOST: "aws-1-eu-west-1.pooler.supabase.com" }],
  ["wrong tenant", { SUPABASE_PROJECT_REF: "bbbbbbbbbbbbbbbbbbbb" }],
  ["admin account", { SUPABASE_DB_ROLE: "postgres", DATABASE_URL: cloudEnvironment.DATABASE_URL.replace("novely_backend.", "postgres.") }],
  ["transaction pooler", { DATABASE_URL: cloudEnvironment.DATABASE_URL.replace(":5432/", ":6543/") }],
  ["SSL URL override", { DATABASE_URL: cloudEnvironment.DATABASE_URL + "&sslmode=no-verify" }],
  ["SSL disabled globally", { NODE_TLS_REJECT_UNAUTHORIZED: "0" }],
  ["missing CA", { DATABASE_CA_FILE: undefined }],
]) {
  test(`Supabase rejects ${name} without exposing the password`, () => {
    assert.throws(() => parseDatabaseConfig({ ...cloudEnvironment, ...change }, caOptions), (error) => {
      assert.equal(error.message.includes("unit_only_password"), false);
      assert.equal(error.message.includes("postgresql://"), false);
      return true;
    });
  });
}

test("unreadable or invalid CA fails closed without printing file contents", () => {
  for (const readCa of [() => { throw new Error("PRIVATE_CA_PATH"); }, () => "PRIVATE_NOT_A_CERTIFICATE"]) {
    assert.throws(() => parseDatabaseConfig(cloudEnvironment, { readCa }), (error) => !error.message.includes("PRIVATE_"));
  }
});

function admittedClient(overrides = {}) {
  const schema = readFileSync(new URL("../prisma/transition/schema.prisma", import.meta.url), "utf8");
  const names = [...schema.matchAll(/@@map\("([a-z_]+)"\)/g)].map((match) => match[1]);
  names.push("chapter_contents", "chapter_likes");
  const identity = {
    database: "postgres", role: "novely_backend", version: 170012, project_ref: null,
    login: true, read_only: true, public_usage: true, genres_select: true,
    superuser: false, create_database: false, create_role: false, replication: false,
    bypass_rls: false, public_create: false, privileged_membership: false,
    owns_application_relation: false, unexpected_schema_privileges: false,
    unsafe_function_access: false, unexpected_data_privileges: false, ...overrides,
  };
  let calls = 0;
  return {
    connection: { stream: { encrypted: true, authorized: true } },
    async query() { return { rows: ++calls === 1 ? [identity] : names.sort().map((name) => ({ name })) }; },
    get calls() { return calls; },
  };
}

test("connection admission allows the least-privilege role over verified TLS", async () => {
  const client = admittedClient();
  await verifySupabaseConnection(client, parseDatabaseConfig(cloudEnvironment, caOptions));
  assert.equal(client.calls, 2);
});

test("TLS must be verified before any SQL is sent", async () => {
  const client = admittedClient();
  client.connection.stream.authorized = false;
  await assert.rejects(verifySupabaseConnection(client, parseDatabaseConfig(cloudEnvironment, caOptions)));
  assert.equal(client.calls, 0);
});

for (const [name, overrides] of [
  ["inherited postgres role", { privileged_membership: true }],
  ["BYPASSRLS", { bypass_rls: true }],
  ["excess data privileges", { unexpected_data_privileges: true }],
  ["relation ownership", { owns_application_relation: true }],
  ["unapproved schema access", { unexpected_schema_privileges: true }],
  ["SECURITY DEFINER access", { unsafe_function_access: true }],
  ["write-capable session", { read_only: false }],
  ["wrong role", { role: "postgres" }],
  ["wrong project", { project_ref: "bbbbbbbbbbbbbbbbbbbb" }],
]) {
  test(`connection admission rejects ${name} before Prisma can acquire it`, async () => {
    const client = admittedClient(overrides);
    await assert.rejects(verifySupabaseConnection(client, parseDatabaseConfig(cloudEnvironment, caOptions)));
    assert.equal(client.calls, 1);
  });
}
