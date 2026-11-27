import express from "express";
import { loadConfig } from "./config/env.js";
import { createCorsMiddleware } from "./middlewares/cors.js";
import { createErrorHandler } from "./middlewares/error-handler.js";
import { notFound } from "./middlewares/not-found.js";
import { createApiRouter } from "./routes.js";
import { configureJsonSerialization } from "./shared/http/json.js";

// Creating the app never opens a port or connects to a database.
export function createApp({ config = loadConfig(), logger = console, getClient, readinessTimeoutMs } = {}) {
  const app = express();
  configureJsonSerialization(app);
  app.disable("x-powered-by");
  app.use(createCorsMiddleware(config.corsOrigins));
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/v1", createApiRouter({ getClient, readinessTimeoutMs }));
  app.use(notFound);
  app.use(createErrorHandler(logger));
  return app;
}
