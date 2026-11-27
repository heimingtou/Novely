import express, { Router } from "express";
import { createErrorHandler } from "../../src/middlewares/error-handler.js";
import { ApiError } from "../../src/shared/errors/api-error.js";
import { configureJsonSerialization } from "../../src/shared/http/json.js";

// Test-only service/controller/router. Never imported by app.js/routes.js.
// Production exposes readiness only; authenticated Library APIs are a later task.
export function createDatabaseHarness({ repository, transaction, operations, logger }) {
  const options = { transaction };
  const service = {
    create: (data) => repository.create(data, options),
    find: async (userId, novelId) => {
      const result = await repository.find(userId, novelId, options);
      if (!result) throw new ApiError(404, "RECORD_NOT_FOUND", "Không tìm thấy dữ liệu.");
      return result;
    },
    update: (userId, novelId, status) => repository.updateStatus(userId, novelId, status, options),
    remove: (userId, novelId) => repository.remove(userId, novelId, options),
    execute: (name) => {
      if (!Object.hasOwn(operations, name)) throw new ApiError(404, "NOT_FOUND", "Không có thao tác thử nghiệm.");
      return operations[name]();
    },
  };
  const controller = {
    create: async (request, response) => response.status(201).json({ data: await service.create(request.body) }),
    find: async (request, response) => response.json({ data: await service.find(Number(request.params.userId), Number(request.params.novelId)) }),
    update: async (request, response) => response.json({ data: await service.update(Number(request.params.userId), Number(request.params.novelId), request.body.readingStatus) }),
    remove: async (request, response) => response.json({ data: await service.remove(Number(request.params.userId), Number(request.params.novelId)) }),
    execute: async (request, response) => response.json({ data: await service.execute(request.params.name) }),
  };
  const router = Router();
  router.post("/bookshelf", controller.create);
  router.get("/bookshelf/:userId/:novelId", controller.find);
  router.patch("/bookshelf/:userId/:novelId", controller.update);
  router.delete("/bookshelf/:userId/:novelId", controller.remove);
  router.post("/operation/:name", controller.execute);
  const app = configureJsonSerialization(express());
  app.use(express.json({ limit: "100kb" }));
  app.use("/__be023", router);
  app.use(createErrorHandler(logger));
  return app;
}
