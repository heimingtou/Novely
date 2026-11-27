import { Router } from "express";
import { createReadinessController, getHealthController } from "./health.controller.js";
import { createHealthRepository } from "./health.repository.js";
import { createReadinessService } from "./health.service.js";

export function createHealthRouter({ getClient, readinessTimeoutMs } = {}) {
  const router = Router();
  const repository = createHealthRepository({ getClient });
  const service = createReadinessService({ repository, timeoutMs: readinessTimeoutMs });
  router.get("/", getHealthController);
  router.get("/ready", createReadinessController({ service }));
  return router;
}

export const healthRouter = createHealthRouter();
