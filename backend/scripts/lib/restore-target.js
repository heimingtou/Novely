import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { loadDatabaseConfig } from "../../src/config/database.js";

export const legacyCounts = Object.freeze({
  bookshelves: 642, chapter_contents: 1054, chapter_likes: 2101, chapters: 1054,
  comments: 1749, follows: 746, genres: 24, interact_novel: 60,
  interact_novel_day: 1410, novel_genres: 122, novel_likes: 743, novels: 61,
  profiles: 202, reading_progress: 1530, reviews: 526, users: 202,
});
export const legacyTables = Object.freeze(Object.keys(legacyCounts).sort());
export const forumTables = Object.freeze(["forum_category", "forum_comment", "forum_post", "forum_reaction", "forum_report"]);
export const migrationPath = new URL("../../../database/migrations/20261125_01_expand_legacy.sql", import.meta.url);

export function restoreConfig() {
  // Reuse local credentials in memory. Never connect to the baseline URL.
  // The application's BE02.2/3 database gate stays unchanged.
  const config = loadDatabaseConfig();
  assert.equal(config.profile, "local", "Local restore tooling requires the baseline Local profile; never Supabase");
  const url = new URL(config.pool.connectionString);
  url.pathname = "/novely_restore_test";
  return { url: url.toString(), pool: { ...config.pool, connectionString: url.toString(), max: 2, application_name: "novely-be02.4-local" } };
}

export async function verifyRestore(client) {
  const { rows: [target] } = await client.query(`SELECT current_database() AS database,
    host(inet_server_addr()) AS host, inet_server_port() AS port,
    current_setting('server_version') AS version`);
  assert.equal(target.database, "novely_restore_test", "STOP: wrong database");
  assert.equal(target.host, "127.0.0.1", "STOP: wrong host");
  assert.equal(target.port, 5432, "STOP: wrong port");
  return target;
}

export async function openRestore() {
  const pool = new pg.Pool(restoreConfig().pool);
  pool.on("error", () => {});
  try {
    const client = await pool.connect();
    try { await verifyRestore(client); } catch (error) { client.release(); throw error; }
    return { pool, client };
  } catch (error) { await pool.end(); throw error; }
}

export async function catalog(client) {
  const sql = await readFile(new URL("../sql/catalog-snapshot.sql", import.meta.url), "utf8");
  const { rows: [{ catalog: metadata }] } = await client.query(sql);
  // The older helper only inventories trigger functions; include recalc too.
  metadata.allFunctions = (await client.query(`SELECT p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS args, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' ORDER BY p.proname,p.oid`)).rows;
  return metadata;
}

export async function rowCounts(client) {
  const result = {};
  for (const name of legacyTables) {
    result[name] = (await client.query(`SELECT count(*)::integer AS count FROM public."${name}"`)).rows[0].count;
  }
  return result;
}

export async function dataSignatures(client, columns) {
  // Compute on the server. Only aggregate checksums leave PostgreSQL, never
  // names/emails/password hashes/content. Signatures remain in process memory.
  const result = {};
  for (const name of legacyTables) {
    const list = columns.filter((column) => column.table === name).map((column) => column.name);
    assert.ok(list.length);
    assert.ok(list.every((column) => /^[a-z_0-9]+$/.test(column)));
    const projection = list.map((column) => `"${column}"`).join(",");
    const sql = `SELECT count(*)::integer AS count,
      md5(COALESCE(string_agg(h,'' ORDER BY h),'')) AS signature
      FROM (SELECT md5(row_to_json(original_row)::text) AS h
        FROM (SELECT ${projection} FROM public."${name}") original_row) checksums`;
    result[name] = (await client.query(sql)).rows[0];
  }
  return result;
}

export async function contentSummary(client) {
  return (await client.query(`SELECT count(*)::integer AS chapters,
    count(cc.chapter_id)::integer AS legacy_contents,
    count(*) FILTER (WHERE cc.chapter_id IS NOT NULL AND
      pg_catalog.convert_to(c.content,'UTF8') IS DISTINCT FROM pg_catalog.convert_to(cc.content,'UTF8'))::integer AS mismatches,
    count(*) FILTER (WHERE cc.chapter_id IS NULL AND c.content <> '')::integer AS missing_nonempty
    FROM public.chapters c LEFT JOIN public.chapter_contents cc USING(chapter_id)`)).rows[0];
}
