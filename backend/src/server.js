import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";

export async function startServer({ config = loadEnvironment(), logger = console } = {}) {
  const server = createServer(createApp({ config, logger }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, () => {
      server.off("error", reject);
      resolve();
    });
  });
  logger.info(`[backend] Listening on port ${server.address().port}`);
  return server;
}

export function shutdownServer(server, logger = console) {
  const timer = setTimeout(() => {
    logger.error("[backend] Shutdown timed out; closing remaining connections.");
    server.closeAllConnections();
    process.exitCode = 1;
  }, 10_000);
  timer.unref();
  server.once("close", () => clearTimeout(timer));
  server.close((error) => {
    if (error) {
      logger.error("[backend] Shutdown failed", error);
      process.exitCode = 1;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const server = await startServer();
    const shutdown = () => shutdownServer(server);
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error("[backend] Startup failed:", error.message);
    process.exitCode = 1;
  }
}
