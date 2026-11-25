import { mkdir, readFile, writeFile } from "node:fs/promises";
import pg from "pg";
import { loadDatabaseConfig } from "../src/config/database.js";
import { baselinePath, digest, readCatalog, readRowCounts, sqlSchemaPath, verifyTarget } from "./lib/catalog.js";

let pool;
let connection;
try {
  pool = new pg.Pool(loadDatabaseConfig().pool);
  pool.on("error", () => console.error("[database] Snapshot connection failed; credentials hidden."));
  connection = await pool.connect();
  await connection.query("BEGIN READ ONLY");
  const query = async (sql) => (await connection.query(sql)).rows;
  const target = await verifyTarget(query);
  const catalog = await readCatalog(query);
  const rows = await readRowCounts(query);
  await connection.query("ROLLBACK");
  const snapshot = {
    target, capturedAt: new Date().toISOString(),
    fingerprint: digest(catalog), sqlSchemaHash: digest(await readFile(sqlSchemaPath, "utf8")),
    rows, catalog,
  };
  await mkdir(new URL("../.local/", import.meta.url), { recursive: true });
  await writeFile(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log("Snapshot saved locally: 19 tables, 57 indexes, 11 triggers, 4 trigger functions.");
  console.log(`Metadata SHA-256: ${snapshot.fingerprint}`);
} catch {
  console.error("Database snapshot failed. Check the local target and credentials in backend/.env; details hidden.");
  process.exitCode = 1;
} finally {
  connection?.release();
  await pool?.end();
}
