import { ApiError } from "../shared/errors/api-error.js";

export function notFound(_request, _response, next) {
  next(new ApiError(404, "NOT_FOUND", "Không tìm thấy đường dẫn API."));
}
