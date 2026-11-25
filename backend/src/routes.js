import { Router } from "express";
import { createHealthRouter } from "./modules/health/health.routes.js";

export function createApiRouter(dependencies = {}) {
  const router = Router();
  router.use("/health", createHealthRouter(dependencies));
  return router;
}

export const apiRouter = createApiRouter();
