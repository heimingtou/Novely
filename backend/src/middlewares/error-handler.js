import { ApiError } from "../shared/errors/api-error.js";

const BODY_ERRORS = {
  "entity.parse.failed": [400, "INVALID_JSON", "Nội dung JSON không hợp lệ."],
  "entity.too.large": [413, "PAYLOAD_TOO_LARGE", "Nội dung yêu cầu vượt quá giới hạn 100 KB."],
  "encoding.unsupported": [415, "UNSUPPORTED_ENCODING", "Kiểu mã hóa nội dung không được hỗ trợ."],
  "charset.unsupported": [415, "UNSUPPORTED_CHARSET", "Bảng mã nội dung không được hỗ trợ."],
  "request.aborted": [400, "REQUEST_ABORTED", "Yêu cầu đã bị ngắt."],
  "request.size.invalid": [400, "INVALID_BODY_SIZE", "Kích thước nội dung yêu cầu không hợp lệ."],
};

export function createErrorHandler(logger = console) {
  // Express identifies error middleware by all four parameters.
  return function errorHandler(error, _request, response, next) {
    if (response.headersSent) return next(error);

    const bodyError = Object.hasOwn(BODY_ERRORS, error?.type) ? BODY_ERRORS[error.type] : null;
    if (bodyError) {
      const [status, code, message] = bodyError;
      return response.status(status).json({ error: { code, message } });
    }

    if (error instanceof ApiError && Number.isInteger(error.status)
      && error.status >= 400 && error.status < 500) {
      return response.status(error.status).json({ error: { code: error.code, message: error.message } });
    }

    logger.error("[backend] Unhandled request error", error);
    return response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Lỗi máy chủ." } });
  };
}
