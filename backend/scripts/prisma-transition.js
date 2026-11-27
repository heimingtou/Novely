import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { restoreConfig } from "./lib/restore-target.js";

try {
  const command = process.argv[2];
  if (process.argv.length !== 3 || !["validate", "generate"].includes(command)) throw new Error();
  const config = restoreConfig();
  const url = new URL(config.url);
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)), command,
    "--config", fileURLToPath(new URL("../prisma.transition.config.mjs", import.meta.url)),
  ], { cwd: fileURLToPath(new URL("../", import.meta.url)), env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" }, encoding: "utf8", timeout: 120_000 });
  const redact = (value = "") => {
    for (const secret of [config.url, url.password, decodeURIComponent(url.password)]) if (secret) value = value.replaceAll(secret, "[REDACTED]");
    return value.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[DATABASE_URL REDACTED]");
  };
  if (result.stdout) process.stdout.write(redact(result.stdout));
  if (result.stderr) process.stderr.write(redact(result.stderr));
  process.exitCode = result.error ? 1 : result.status ?? 1;
} catch { console.error("Prisma transition command failed; configuration remains private."); process.exitCode = 1; }
