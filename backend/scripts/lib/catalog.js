import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const tables = Object.freeze([
  "bookshelves", "chapters", "comments", "follows", "forum_category",
  "forum_comment", "forum_post", "forum_reaction", "forum_report", "genres",
  "interact_novel", "interact_novel_day", "novel_genres", "novel_likes",
  "novels", "profiles", "reading_progress", "reviews", "users",
]);
export const catalogSql = readFileSync(new URL("../sql/catalog-snapshot.sql", import.meta.url), "utf8");
export const baselinePath = new URL("../../.local/be02_2-before.json", import.meta.url);
export const sqlSchemaPath = new URL("../../../database/schema.sql", import.meta.url);

export function digest(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

export async function verifyTarget(query) {
  const [target] = await query(`SELECT current_database() AS database,
    host(inet_server_addr()) AS host, inet_server_port() AS port,
    current_setting('server_version') AS version`);
  assert.equal(target.database, "novely_reconcile_test", "Unexpected database");
  assert.equal(target.host, "127.0.0.1", "Unexpected PostgreSQL host");
  assert.equal(target.port, 5432, "Unexpected PostgreSQL port");
  return target;
}

export async function readCatalog(query) {
  const [{ catalog }] = await query(catalogSql);
  assert.deepEqual(catalog.tables.map((table) => table.name), tables);
  assert.equal(catalog.indexes.length, 57);
  assert.equal(catalog.triggers.length, 11);
  assert.equal(catalog.functions.length, 4);
  for (const [type, expected] of [["p", 19], ["u", 11], ["f", 30], ["c", 49]]) {
    assert.equal(catalog.constraints.filter((constraint) => constraint.type === type).length, expected);
  }
  return catalog;
}

export async function readRowCounts(query) {
  // Identifiers come exclusively from the fixed allowlist above.
  const rows = await query(tables.map((name) =>
    `SELECT '${name}'::text AS name, count(*)::text AS count FROM public."${name}"`
  ).join(" UNION ALL "));
  return Object.fromEntries(rows.map(({ name, count }) => [name, count]));
}
