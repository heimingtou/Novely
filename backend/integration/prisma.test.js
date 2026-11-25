import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { Prisma } from "../src/generated/prisma/index.js";
import { loadDatabaseConfig } from "../src/config/database.js";
import { loadConfig } from "../src/config/env.js";
import { disconnectDatabase, getPrisma } from "../src/database/prisma.js";
import { shutdownServer, startServer } from "../src/server.js";
import { baselinePath, digest, readCatalog, readRowCounts, sqlSchemaPath, tables, verifyTarget } from "../scripts/lib/catalog.js";

const delegate = (model) => model.name[0].toLowerCase() + model.name.slice(1);
const sentinel = (field) => field.type === "BigInt" ? -1n
  : field.type === "DateTime" ? new Date("2000-01-01T00:00:00.000Z") : -1;
const models = Prisma.dmmf.datamodel.models;
// Prisma 7's runtime DMMF omits PK/default/relation-column details. Read those
// from the validated PSL rather than relying on removed runtime metadata.
const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const blocks = new Map([...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
  .map((match) => [match[1], match[2]]));
const fieldLine = (model, field) => blocks.get(model.name).split("\n")
  .find((line) => new RegExp(`^\\s+${field.name}\\s+`).test(line));
const columnList = (value) => value.split(",").map((name) => name.trim());
function relationDetails(model, field) {
  const line = fieldLine(model, field);
  if (!line.includes("fields:")) return null;
  return {
    fields: columnList(line.match(/fields:\s*\[([^\]]+)\]/)[1]),
    references: columnList(line.match(/references:\s*\[([^\]]+)\]/)[1]),
    map: line.match(/map:\s*"([^"]+)"/)[1],
    onDelete: line.match(/onDelete:\s*(\w+)/)?.[1],
    onUpdate: line.match(/onUpdate:\s*(\w+)/)?.[1],
  };
}

// Database errors can contain configuration details: never print the raw object.
async function safeRead(action) {
  try { return await action(); } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    const code = /^P\d{4}$/.test(error?.code ?? "") ? ` (${error.code})` : "";
    throw new Error(`PostgreSQL/Prisma read failed${code}; connection details hidden.`);
  }
}

test("BE02.2 Prisma integration on the accepted Local database", { timeout: 60_000 }, async (context) => {
  let control;
  let server;
  context.after(async () => {
    if (server?.listening) await shutdownServer(server, { info() {}, error() {} });
    await disconnectDatabase();
    await control?.end();
  });

  let baseline;
  try { baseline = JSON.parse(await readFile(baselinePath, "utf8")); } catch {
    throw new Error("Run npm.cmd run db:snapshot before integration tests; do not replace an existing baseline during the task.");
  }
  const config = loadDatabaseConfig();
  control = new pg.Pool({ ...config.pool, max: 1, application_name: "novely-be02.2-audit" });
  control.on("error", () => console.error("[database-test] Audit connection failed; details hidden."));
  const controlQuery = (sql, values) => safeRead(async () => (await control.query(sql, values)).rows);
  await verifyTarget(controlQuery);
  const before = await readCatalog(controlQuery);

  await context.test("full catalog matches the snapshot taken before introspection", () => {
    assert.equal(digest(before), baseline.fingerprint);
    assert.deepEqual(before, baseline.catalog);
  });
  await context.test("database/schema.sql is unchanged", async () => {
    assert.equal(digest(await readFile(sqlSchemaPath, "utf8")), baseline.sqlSchemaHash);
  });
  await context.test("19 PascalCase models map to the exact 19 business tables", () => {
    assert.equal(models.length, 19);
    assert.deepEqual(models.map((model) => model.dbName).sort(), tables);
    assert.ok(models.every((model) => /^[A-Z]/.test(model.name)));
  });
  await context.test("all scalar columns retain their PostgreSQL types and nullability", () => {
    const types = { integer: "Int", smallint: "Int", bigint: "BigInt", real: "Float",
      text: "String", "character varying": "String", boolean: "Boolean",
      date: "DateTime", "timestamp with time zone": "DateTime" };
    for (const model of models) {
      const fields = model.fields.filter((field) => field.kind === "scalar");
      const columns = before.columns.filter((column) => column.table === model.dbName);
      assert.equal(fields.length, columns.length);
      for (const field of fields) {
        const column = columns.find((candidate) => candidate.name === (field.dbName ?? field.name));
        assert.ok(column, `${model.name}.${field.name} maps to a column`);
        assert.equal(field.type, types[column.type]);
        const line = fieldLine(model, field);
        assert.equal(!new RegExp(`\\s${field.type}\\?`).test(line), column.notNull);
        if (column.type === "smallint") assert.match(line, /@db\.SmallInt/);
        if (column.type === "real") assert.match(line, /@db\.Real/);
        if (column.type === "date") assert.match(line, /@db\.Date\b/);
        if (column.type === "timestamp with time zone") assert.match(line, /@db\.Timestamptz\(6\)/);
        if (column.type === "character varying") assert.match(line, /@db\.VarChar\b/);
      }
    }
  });
  await context.test("all 27 explicit indexes retain mapped names, columns and sort order", () => {
    let count = 0;
    for (const model of models) {
      for (const match of blocks.get(model.name).matchAll(/@@index\(\[([^\]]+)\], map: "([^"]+)"\)/g)) {
        const columns = columnList(match[1]).map((value) => {
          const [, name, descending] = value.match(/^(\w+)(?:\(sort: (Desc)\))?$/);
          const field = model.fields.find((candidate) => candidate.name === name);
          return (field.dbName ?? field.name) + (descending ? " DESC" : "");
        }).join(", ");
        const index = before.indexes.find((candidate) => candidate.name === match[2]);
        assert.equal(index.table, model.dbName);
        assert.equal(index.definition.match(/USING btree \((.*)\)$/)[1], columns);
        count++;
      }
    }
    assert.equal(count, 27);
  });

  const clients = await safeRead(() => Promise.all([getPrisma(), getPrisma(), getPrisma()]));
  const prisma = clients[0];
  await context.test("concurrent accessors reuse one Prisma Client", () => {
    assert.ok(clients.every((client) => client === prisma));
  });
  await safeRead(() => prisma.$connect());
  const pids = [];

  await safeRead(() => prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const query = (sql) => safeRead(() => tx.$queryRawUnsafe(sql));
    await context.test("Prisma connects to the expected host/port/database in read-only mode", async () => {
      await verifyTarget(query);
      const [{ setting, zone, pid }] = await query("SELECT current_setting('transaction_read_only') AS setting, current_setting('TimeZone') AS zone, pg_backend_pid() AS pid");
      assert.equal(setting, "on");
      assert.equal(zone, "UTC");
      pids.push(pid);
    });

    for (const model of models) {
      await context.test(`read model ${model.name} including its mapped columns`, async () => {
        const select = Object.fromEntries(model.fields.filter((field) => field.kind === "scalar" && field.name !== "passwordHash")
          .map((field) => [field.name, true]));
        const rows = await safeRead(() => tx[delegate(model)].findMany({ select, take: 1 }));
        const count = await safeRead(() => tx[delegate(model)].count());
        assert.equal(String(count), baseline.rows[model.dbName]);
        assert.equal(rows.length, Math.min(count, 1));
      });
      for (const field of model.fields.filter((field) => field.kind === "object" && relationDetails(model, field))) {
        await context.test(`read relation ${model.name}.${field.name}`, async () => {
          const relation = relationDetails(model, field);
          const target = models.find((candidate) => candidate.name === field.type);
          const targetId = target.fields.find((candidate) => candidate.name === relation.references[0]);
          const constraint = before.constraints.find((candidate) => candidate.name === relation.map);
          assert.equal(constraint.table, model.dbName);
          assert.equal(constraint.type, "f");
          assert.equal(relation.onDelete, { c: "Cascade", r: "Restrict", a: "NoAction", n: "SetNull" }[constraint.deleteAction]);
          assert.equal(relation.onUpdate, "NoAction");
          const native = constraint.definition.match(/^FOREIGN KEY \(([^)]+)\) REFERENCES (?:public\.)?(\w+)\(([^)]+)\)/);
          assert.deepEqual(columnList(native[1]), relation.fields.map((name) => {
            const source = model.fields.find((candidate) => candidate.name === name);
            return source.dbName ?? source.name;
          }));
          assert.equal(native[2], target.dbName);
          assert.deepEqual(columnList(native[3]), relation.references.map((name) => {
            const source = target.fields.find((candidate) => candidate.name === name);
            return source.dbName ?? source.name;
          }));
          const rows = await safeRead(() => tx[delegate(model)].findMany({
            where: { [field.name]: { is: { [targetId.name]: sentinel(targetId) } } },
            select: { [model.fields.find((candidate) => candidate.kind === "scalar").name]: true }, take: 1,
          }));
          assert.equal(rows.length, 0);
        });
      }
      const compoundKeys = [...blocks.get(model.name).matchAll(/@@(?:id|unique)\(\[([^\]]+)\][^\n]*\)/g)]
        .map((match) => ({ fields: columnList(match[1]) }));
      for (const key of compoundKeys) {
        await context.test(`read compound key ${model.name}(${key.fields.join(",")})`, async () => {
          const values = Object.fromEntries(key.fields.map((name) => [name, sentinel(model.fields.find((field) => field.name === name))]));
          const row = await safeRead(() => tx[delegate(model)].findUnique({
            where: { [key.fields.join("_")]: values },
            select: { [key.fields[0]]: true },
          }));
          assert.equal(row, null);
        });
      }
    }

    await context.test("BigInt, timestamptz, date, smallint and real round-trip without fixture writes", async () => {
      const [row] = await query(`SELECT 9223372036854775806::bigint AS big,
        TIMESTAMPTZ '2026-11-25 08:30:00.123+00' AS stamp, DATE '2026-11-25' AS day,
        32767::smallint AS small, 0.5::real AS progress`);
      assert.equal(row.big, 9223372036854775806n);
      assert.equal(row.stamp.toISOString(), "2026-11-25T08:30:00.123Z");
      assert.equal(row.day.toISOString(), "2026-11-25T00:00:00.000Z");
      assert.equal(row.small, 32767);
      assert.equal(row.progress, 0.5);
    });
    await context.test("explicit timezone offsets preserve the same instant", async () => {
      const [row] = await query(`SELECT TIMESTAMPTZ '2026-11-25 15:30:00.123+07' AS local_stamp,
        TIMESTAMPTZ '2026-11-24 23:59:59.999+00' AS boundary`);
      assert.equal(row.local_stamp.toISOString(), "2026-11-25T08:30:00.123Z");
      assert.equal(row.boundary.toISOString(), "2026-11-24T23:59:59.999Z");
    });
    await context.test("a bound JavaScript Date retains its instant through the adapter", async () => {
      const value = new Date("2026-11-25T08:30:00.123Z");
      const [row] = await safeRead(() => tx.$queryRaw`SELECT ${value}::timestamptz AS stamp`);
      assert.equal(row.stamp.toISOString(), value.toISOString());
    });
    await context.test("all ten GENERATED ALWAYS identity columns remain database-owned", () => {
      const identities = before.columns.filter((column) => column.identity);
      assert.equal(identities.length, 10);
      for (const column of identities) {
        assert.equal(column.identity, "a");
        const model = models.find((candidate) => candidate.dbName === column.table);
        const field = model.fields.find((candidate) => (candidate.dbName ?? candidate.name) === column.name);
        assert.match(fieldLine(model, field), /@default\(autoincrement\(\)\)/);
      }
    });
    await context.test("partial SET NULL keeps novel_id required and targets chapter_id only", () => {
      const constraint = before.constraints.find((item) => item.name === "fk_reading_progress_chapter");
      assert.match(constraint.definition, /ON DELETE SET NULL \(chapter_id\)/);
      assert.equal(constraint.deleteAction, "n");
      const model = models.find((candidate) => candidate.name === "ReadingProgress");
      assert.match(fieldLine(model, { name: "novelId" }), /\bInt\s/);
      assert.match(fieldLine(model, { name: "chapterId" }), /\bInt\?/);
      assert.deepEqual(relationDetails(model, { name: "chapter" }).fields, ["chapterId", "novelId"]);
    });
  }, { timeout: 45_000, maxWait: 5_000, isolationLevel: "RepeatableRead" }));

  await context.test("disconnect is idempotent and a subsequent accessor creates a usable client", async () => {
    await Promise.all([disconnectDatabase(), disconnectDatabase()]);
    const replacement = await safeRead(() => getPrisma());
    assert.notEqual(replacement, prisma);
    const [{ pid }] = await safeRead(() => replacement.$queryRaw`SELECT pg_backend_pid() AS pid`);
    pids.push(pid);
  });
  await context.test("HTTP shutdown also disconnects the active Prisma Client and external pool", async () => {
    const logger = { info() {}, error() { assert.fail("Server shutdown failed; details hidden"); } };
    server = await startServer({ config: { ...loadConfig({ NODE_ENV: "test" }), port: 0 }, logger });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, "ok");
    await shutdownServer(server, logger);
    const [{ active }] = await controlQuery("SELECT count(*)::integer AS active FROM pg_catalog.pg_stat_activity WHERE pid=ANY($1::integer[])", [pids]);
    assert.equal(active, 0);
  });
  await context.test("all definitions, policies, grants and sequence state are unchanged after reads", async () => {
    const after = await readCatalog(controlQuery);
    assert.deepEqual(after, before);
    assert.equal(digest(after), baseline.fingerprint);
    assert.deepEqual(await readRowCounts(controlQuery), baseline.rows);
  });
});
