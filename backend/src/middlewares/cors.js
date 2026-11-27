import cors from "cors";
import { ApiError } from "../shared/errors/api-error.js";

export function createCorsMiddleware(corsOrigins) {
  const allowed = new Set(corsOrigins);
  return cors({
    origin(origin, callback) {
      // CLI/server requests may have no Origin header.
      if (!origin || allowed.has(origin)) return callback(null, true);
      return callback(new ApiError(403, "CORS_ORIGIN_DENIED", "Origin không được phép truy cập API."));
    },
    credentials: true,
  });
}
