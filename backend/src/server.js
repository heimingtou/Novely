import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";
import { disconnectDatabase } from "./database/prisma.js";

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
  return new Promise((resolve) => {
    // Stop accepting requests and drain HTTP work before closing database sockets.
    server.close(async (error) => {
      if (error) {
        logger.error("[backend] Shutdown failed", error);
        process.exitCode = 1;
      }
      try {
        await disconnectDatabase();
      } catch {
        logger.error("[backend] Database shutdown failed; details hidden.");
        process.exitCode = 1;
      } finally {
        clearTimeout(timer);
        resolve();
      }
    });
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
