import { Router } from "express";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";

export function createApiRouter(dependencies = {}) {
  const router = Router();
  router.use("/health", createHealthRouter(dependencies));
  router.use("/auth", createAuthRouter(dependencies));
  return router;
}

export const apiRouter = createApiRouter();
