import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadDatabaseConfig } from "../src/config/database.js";

// Expose only the read/generation commands needed for this foundation.
const commands = {
  introspect: ["db", "pull"],
  validate: ["validate"],
  generate: ["generate"],
  format: ["format"],
};

try {
  const args = Object.hasOwn(commands, process.argv[2]) ? commands[process.argv[2]] : null;
  if (!args || process.argv.length !== 3) throw new Error("Chỉ hỗ trợ introspect, validate, generate, format.");
  const config = loadDatabaseConfig();
  const url = new URL(config.url);
  const redact = (value) => {
    let output = value ?? "";
    for (const secret of [config.url, url.password, decodeURIComponent(url.password)]) {
      if (secret) output = output.replaceAll(secret, "[REDACTED]");
    }
    return output.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[DATABASE_URL REDACTED]");
  };
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)),
    ...args, "--config", fileURLToPath(new URL("../prisma.config.mjs", import.meta.url)),
  ], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: { ...process.env, DATABASE_URL: config.url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    encoding: "utf8", timeout: 120_000, maxBuffer: 5 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(redact(result.stdout));
  if (result.stderr) process.stderr.write(redact(result.stderr));
  if (result.error) console.error("Prisma CLI không hoàn tất; lỗi gốc được giữ kín để bảo vệ cấu hình.");
  process.exitCode = result.error ? 1 : result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
