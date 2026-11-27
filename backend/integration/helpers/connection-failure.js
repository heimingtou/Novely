import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { loadDatabaseConfig } from "../../src/config/database.js";

// A separate client exists only in this test to reproduce the real adapter's
// authentication failure. Production repositories always reuse getPrisma().
export async function createFailingTestClient() {
  const config = loadDatabaseConfig();
  const url = new URL(config.pool.connectionString);
  url.password = "BE023_INTENTIONALLY_INVALID_AUTH_TEST";
  const pool = new pg.Pool({ ...config.pool, connectionString: url.toString(), max: 1, connectionTimeoutMillis: 1_000 });
  pool.on("error", () => {});
  const client = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public", disposeExternalPool: false }), log: [], errorFormat: "minimal" });
  return {
    client,
    async dispose() { try { await client.$disconnect(); } finally { await pool.end(); } },
  };
}
