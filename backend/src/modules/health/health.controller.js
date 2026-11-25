import { getHealth } from "./health.service.js";

export function getHealthController(_request, response) {
  response.set("Cache-Control", "no-store");
  return response.status(200).json({ data: getHealth() });
}

export function createReadinessController({ service }) {
  return async function getReadinessController(_request, response) {
    response.set("Cache-Control", "no-store");
    if (!await service.check()) {
      return response.status(503).json({ error: { code: "DATABASE_UNAVAILABLE", message: "Cơ sở dữ liệu chưa sẵn sàng." } });
    }
    return response.status(200).json({ data: { status: "ready", service: "novely-backend" } });
  };
}
