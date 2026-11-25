import { getHealth } from "./health.service.js";

export function getHealthController(_request, response) {
  response.set("Cache-Control", "no-store");
  return response.status(200).json({ data: getHealth() });
}
