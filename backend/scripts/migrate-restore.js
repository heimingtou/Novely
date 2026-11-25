import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { catalog, contentSummary, dataSignatures, forumTables, legacyCounts, legacyTables, migrationPath, openRestore, rowCounts } from "./lib/restore-target.js";

export async function runMigration({ apply = false } = {}) {
  const { pool, client } = await openRestore();
  let inTransaction = false;
  try {
    assert.equal((await client.query("SELECT pg_try_advisory_lock(230004) AS locked")).rows[0].locked, true);
    const before = await catalog(client);
    assert.deepEqual(before.tables.map((table) => table.name), legacyTables, "Requires the original 16-table restore");
    assert.deepEqual(await rowCounts(client), legacyCounts, "Restored row counts differ; stop before changing data");
    await client.query("BEGIN");
    inTransaction = true;
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query(`LOCK TABLE ${legacyTables.map((name) => `public."${name}"`).join(",")} IN ACCESS EXCLUSIVE MODE`);
    const signatures = await dataSignatures(client, before.columns);
    await client.query(await readFile(migrationPath, "utf8"));
    await client.query("SAVEPOINT be024_compatibility");
    await client.query(await readFile(new URL("../../database/tests/be02_4-compatibility.sql", import.meta.url), "utf8"));
    await client.query("ROLLBACK TO SAVEPOINT be024_compatibility");
    await client.query("RELEASE SAVEPOINT be024_compatibility");
    const after = await catalog(client);
    assert.equal(after.tables.length, 21);
    assert.deepEqual(await dataSignatures(client, before.columns), signatures, "Legacy data or timestamps changed");
    for (const section of ["columns", "constraints", "indexes", "allFunctions", "policies", "grants"]) {
      for (const original of before[section]) {
        assert.ok(after[section].some((candidate) => JSON.stringify(candidate) === JSON.stringify(original)), `Legacy ${section} changed`);
      }
    }
    for (const trigger of before.triggers.filter((item) => item.name !== "trg_chapters_updated")) {
      assert.ok(after.triggers.some((item) => JSON.stringify(item) === JSON.stringify(trigger)), "Legacy trigger changed");
    }
    const chapterTrigger = after.triggers.find((trigger) => trigger.name === "trg_chapters_updated");
    assert.match(chapterTrigger.definition, /title, content/);
    assert.deepEqual(after.sequences.filter((sequence) => before.sequences.some((old) => old.sequencename === sequence.sequencename)), before.sequences);
    assert.ok(after.tables.filter((table) => forumTables.includes(table.name)).every((table) => table.rls));
    assert.equal(after.policies.filter((policy) => forumTables.includes(policy.tablename)).length, 0);
    assert.deepEqual(await contentSummary(client), { chapters: 1054, legacy_contents: 1054, mismatches: 0, missing_nonempty: 0 });
    assert.equal((await client.query("SELECT count(*)::integer AS count FROM public.bookshelves WHERE reading_status IS NULL")).rows[0].count, 642);
    const report = {
      mode: apply ? "APPLY" : "DRY_RUN_ROLLBACK", target: "127.0.0.1:5432/novely_restore_test",
      legacyRowsBefore: legacyCounts, legacyRowsAfter: await rowCounts(client),
      allLegacyColumnsPreserved: true, legacySequenceStatePreserved: true,
      originalFunctionsPreserved: true, originalConstraintsAndDeleteActionsPreserved: true,
      originalGrantsAndPoliciesPreserved: true, chapterContentMismatches: 0,
      sqlCompatibilityVerified: true,
      unknownLibraryStatus: 642, missingStatistics: 1,
      tablesAfter: after.tables.length, indexesAfter: after.indexes.length,
      triggersAfter: after.triggers.length, triggerFunctionsAfter: after.functions.length,
      completedAt: new Date().toISOString(),
    };
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    inTransaction = false;
    if (!apply) {
      assert.deepEqual(await catalog(client), before, "DDL rollback did not restore the original catalog");
      assert.deepEqual(await dataSignatures(client, before.columns), signatures);
      report.rollbackVerified = true;
    }
    await mkdir(new URL("../.local/", import.meta.url), { recursive: true });
    await writeFile(new URL(`../.local/be02_4-${apply ? "applied" : "dry-run"}.json`, import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    if (inTransaction) await client.query("ROLLBACK");
    await client.query("SELECT pg_advisory_unlock(230004)");
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3 || !["--check", "--apply"].includes(process.argv[2])) throw new Error("Usage");
    const report = await runMigration({ apply: process.argv[2] === "--apply" });
    console.log(JSON.stringify(report, null, 2));
  } catch {
    console.error("STOP: Local migration/check failed and any open transaction was rolled back. Raw errors and data are suppressed.");
    process.exitCode = 1;
  }
}
