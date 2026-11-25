import { loadBackendEnvironment } from "./env.js";

// BE02.2 is intentionally limited to the accepted, isolated local database.
// Change this gate explicitly in a later task before adding a cloud environment.
export function parseDatabaseConfig(environment = process.env) {
  const value = environment.DATABASE_URL;
  let url;
  try {
    url = new URL(value);
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
  } catch {
    throw new Error("DATABASE_URL phải là PostgreSQL URL hợp lệ; giá trị được giữ kín.");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || url.hostname !== "127.0.0.1" || (url.port || "5432") !== "5432"
    || url.pathname !== "/novely_reconcile_test" || !url.username || !url.password
    || url.hash || [...url.searchParams.keys()].some((key) => key !== "schema")
    || url.searchParams.getAll("schema").length > 1
    || (url.searchParams.get("schema") ?? "public") !== "public") {
    throw new Error("BE02.2 chỉ cho phép PostgreSQL Local 127.0.0.1:5432/novely_reconcile_test, schema public.");
  }

  // schema is a Prisma option, not a node-postgres connection parameter.
  url.search = "";
  return Object.freeze({
    url: value,
    schema: "public",
    pool: Object.freeze({
      connectionString: url.toString(),
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      statement_timeout: 15_000,
      application_name: "novely-backend",
      // Prisma 7 adapter-pg assumes UTC when normalizing timestamptz values.
      // Startup options affect only these sessions, never ALTER DATABASE/SYSTEM.
      options: "-c timezone=UTC",
    }),
  });
}

export function loadDatabaseConfig() {
  return parseDatabaseConfig(loadBackendEnvironment());
}
