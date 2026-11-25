import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3100",
  "http://127.0.0.1:3100",
];

// Keep validation separate from loading so tests never need real credentials.
export function loadConfig(environment = process.env) {
  const nodeEnv = environment.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("NODE_ENV phải là development, test hoặc production.");
  }

  const portValue = String(environment.PORT ?? "4000");
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT phải là số nguyên từ 1 đến 65535.");
  }

  const entries = environment.CORS_ORIGINS === undefined
    ? DEFAULT_ORIGINS
    : environment.CORS_ORIGINS.split(",").map((entry) => entry.trim());
  const corsOrigins = entries.map((entry) => {
    try {
      const url = new URL(entry);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
        || url.pathname !== "/" || url.search || url.hash) throw new Error();
      return url.origin;
    } catch {
      // Do not include configuration values in errors.
      throw new Error("CORS_ORIGINS phải chứa các HTTP/HTTPS origin hợp lệ, phân cách bằng dấu phẩy.");
    }
  });

  return Object.freeze({ nodeEnv, port, corsOrigins: Object.freeze([...new Set(corsOrigins)]) });
}

export function loadBackendEnvironment() {
  // Resolve from this module, not cwd, to avoid loading the frontend .env.
  const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
  try {
    loadEnvFile(envPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return process.env;
}

export function loadEnvironment() {
  return loadConfig(loadBackendEnvironment());
}
