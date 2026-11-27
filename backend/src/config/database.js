import { loadBackendEnvironment } from "./env.js";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { X509Certificate } from "node:crypto";

const ADMIN_ROLES = new Set(["postgres", "supabase_admin", "authenticator", "anon", "authenticated", "service_role"]);

export function parseDatabaseConfig(environment = process.env, { readCa = (path) => readFileSync(path, "utf8") } = {}) {
  const profile = environment.DATABASE_PROFILE ?? "local";
  if (!["local", "local-transition", "supabase"].includes(profile)) {
    throw new Error("DATABASE_PROFILE phải là local, local-transition hoặc supabase.");
  }
  const value = environment.DATABASE_URL;
  let url;
  try {
    url = new URL(value);
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
  } catch {
    throw new Error("DATABASE_URL phải là PostgreSQL URL hợp lệ; giá trị được giữ kín.");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.username || !url.password
    || url.hash || [...url.searchParams.keys()].some((key) => key !== "schema")
    || url.searchParams.getAll("schema").length > 1
    || (url.searchParams.get("schema") ?? "public") !== "public") {
    throw new Error("DATABASE_URL phải có tài khoản, database và chỉ được dùng schema public; không thêm SSL/options vào URL.");
  }

  let ssl = false;
  let expectedIdentity;
  if (profile === "supabase") {
    const projectRef = environment.SUPABASE_PROJECT_REF;
    const role = environment.SUPABASE_DB_ROLE;
    const approvedHost = environment.SUPABASE_DB_HOST;
    const direct = url.hostname === `db.${projectRef}.supabase.co`;
    const pooler = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname);
    if (!/^[a-z]{20}$/.test(projectRef ?? "") || !/^[a-z][a-z0-9_]{0,62}$/.test(role ?? "")
      || ADMIN_ROLES.has(role) || /^(pg_|supabase_)/.test(role)
      || !approvedHost || approvedHost !== url.hostname || (!direct && !pooler)
      || (url.port || "5432") !== "5432" || url.pathname !== "/postgres"
      || decodeURIComponent(url.username) !== (pooler ? `${role}.${projectRef}` : role)
      || environment.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
      throw new Error("Supabase runtime yêu cầu host/project/role riêng đã duyệt, database postgres, cổng 5432 và TLS xác minh đầy đủ.");
    }
    const caPath = environment.DATABASE_CA_FILE;
    try {
      if (!caPath || !isAbsolute(caPath)) throw new Error();
      const ca = readCa(caPath);
      if (new X509Certificate(ca).ca !== true) throw new Error();
      ssl = Object.freeze({ ca, rejectUnauthorized: true, servername: url.hostname });
    } catch {
      throw new Error("DATABASE_CA_FILE phải trỏ tới CA tin cậy đọc được; không bỏ xác minh chứng chỉ hoặc hostname.");
    }
    expectedIdentity = Object.freeze({ projectRef, role });
  } else {
    const database = profile === "local" ? "novely_reconcile_test" : "novely_restore_test";
    if (url.hostname !== "127.0.0.1" || (url.port || "5432") !== "5432" || url.pathname !== `/${database}`) {
      throw new Error("Profile Local chỉ cho phép database thử nghiệm đã duyệt tại 127.0.0.1:5432.");
    }
  }

  // schema is a Prisma option, not a node-postgres connection parameter.
  url.search = "";
  return Object.freeze({
    url: value,
    profile,
    client: profile === "local" ? "baseline" : "transition",
    schema: "public",
    expectedIdentity,
    pool: Object.freeze({
      connectionString: url.toString(),
      ssl,
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      statement_timeout: 15_000,
      application_name: "novely-backend",
      // Prisma 7 adapter-pg assumes UTC when normalizing timestamptz values.
      // Startup options affect only these sessions, never ALTER DATABASE/SYSTEM.
      options: profile === "supabase" ? "-c timezone=UTC -c default_transaction_read_only=on" : "-c timezone=UTC",
    }),
  });
}

export function loadDatabaseConfig() {
  return parseDatabaseConfig(loadBackendEnvironment());
}
