import { loadDatabaseConfig } from "../config/database.js";

let runtimePromise;
let shutdownPromise;

async function createRuntime() {
  const config = loadDatabaseConfig();
  // Lazy imports keep health/BE01 independent of credentials and generated files.
  const [{ PrismaClient }, { PrismaPg }, { default: pg }] = await Promise.all([
    import("../generated/prisma/index.js"), import("@prisma/adapter-pg"), import("pg"),
  ]);
  const pool = new pg.Pool(config.pool);
  pool.on("error", () => console.error("[database] Idle connection failed; details hidden."));
  try {
    const adapter = new PrismaPg(pool, { schema: config.schema, disposeExternalPool: false });
    const prisma = new PrismaClient({ adapter, log: [], errorFormat: "minimal" });
    return { pool, prisma };
  } catch {
    await pool.end();
    throw new Error("Không khởi tạo được Prisma Client; kiểm tra generation và cấu hình database.");
  }
}

// Await this accessor from repositories. Concurrent callers share one client/pool.
// Constructing the Express app or importing this module never opens a connection.
export async function getPrisma() {
  if (shutdownPromise) await shutdownPromise;
  const current = runtimePromise ??= createRuntime();
  try {
    return (await current).prisma;
  } catch (error) {
    if (runtimePromise === current) runtimePromise = undefined;
    throw error;
  }
}

export function disconnectDatabase() {
  if (shutdownPromise) return shutdownPromise;
  if (!runtimePromise) return Promise.resolve();
  const current = runtimePromise;
  shutdownPromise = (async () => {
    let runtime;
    try { runtime = await current; } catch { return; }
    try {
      await runtime.prisma.$disconnect();
    } finally {
      // The adapter does not own this external pool; close it exactly once here.
      await runtime.pool.end();
    }
  })().finally(() => {
    if (runtimePromise === current) runtimePromise = undefined;
    shutdownPromise = undefined;
  });
  return shutdownPromise;
}
