import "server-only";

// Định dạng phản hồi thống nhất cho mọi API:
//   thành công: { data, meta? }
//   lỗi:        { error: { code, message } }

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const notFound = (message = "Không tìm thấy dữ liệu") => new ApiError(404, "NOT_FOUND", message);
export const badRequest = (message = "Yêu cầu không hợp lệ") => new ApiError(400, "BAD_REQUEST", message);

export function ok(data, { meta, status = 200 } = {}) {
  return Response.json(meta ? { data, meta } : { data }, { status });
}

export function fail(error) {
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error("[api]", error);
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "Lỗi máy chủ" } }, { status: 500 });
}

// Bọc handler để mọi lỗi ném ra đều trả về JSON đúng định dạng.
export function withErrorHandling(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return fail(error);
    }
  };
}

export function parsePagination(searchParams, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? String(defaultLimit), 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  const from = (page - 1) * limit;
  return { page, limit, from, to: from + limit - 1 };
}

export function parsePositiveInt(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw badRequest(`${name} phải là số nguyên dương`);
  return number;
}

// Chuyển lỗi Supabase/PostgREST thành ApiError.
export function assertNoDbError(error) {
  if (!error) return;
  console.error("[supabase]", error);
  // Ở môi trường dev, kèm thông báo gốc để dễ gỡ lỗi; production thì ẩn đi.
  const detail = process.env.NODE_ENV !== "production" ? ` (${error.code}: ${error.message})` : "";
  throw new ApiError(500, "DATABASE_ERROR", `Không truy vấn được cơ sở dữ liệu${detail}`);
}
