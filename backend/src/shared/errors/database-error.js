const NETWORK_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH"]);
const UNAVAILABLE_CODES = new Set([
  "P1000", "P1001", "P1002", "P1003", "P1008", "P1010", "P1011", "P1017", "P2024", "P2037",
  "28P01", "28000", "53300", "57P01", "57P02", "57P03", "57014",
]);
const UNAVAILABLE_KINDS = new Set([
  "AuthenticationFailed", "DatabaseNotReachable", "ConnectionClosed", "SocketTimeout", "TooManyConnections",
]);

function inspect(error) {
  const codes = [];
  const kinds = [];
  const names = [];
  const seen = new Set();
  const queue = [error];
  while (queue.length && seen.size < 24) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    if (typeof current.name === "string") names.push(current.name);
    if (typeof current.kind === "string") kinds.push(current.kind);
    for (const key of ["code", "errorCode", "originalCode", "sqlState", "sqlstate"]) {
      if (typeof current[key] === "string") codes.push(current[key]);
    }
    for (const key of ["meta", "cause", "driverAdapterError"]) queue.push(current[key]);
  }
  // Never parse SQL/message text or return raw adapter metadata to clients/logs.
  const prismaCode = codes.find((code) => /^P\d{4}$/.test(code));
  const sqlState = codes.find((code) => /^[0-9A-Z]{5}$/.test(code) && !/^P\d{4}$/.test(code));
  return {
    codes, kinds, prismaCode, sqlState,
    isDatabase: Boolean(prismaCode || sqlState || codes.some((code) => NETWORK_CODES.has(code))
      || names.some((name) => name.startsWith("PrismaClient") || name === "DriverAdapterError")),
    initialization: names.includes("PrismaClientInitializationError"),
  };
}

export function mapDatabaseError(error) {
  const info = inspect(error);
  if (!info.isDatabase) return null;
  let mapped;
  if (info.codes.some((code) => UNAVAILABLE_CODES.has(code) || NETWORK_CODES.has(code) || /^08[0-9A-Z]{3}$/.test(code))
    || info.kinds.some((kind) => UNAVAILABLE_KINDS.has(kind))
    || (info.initialization && !info.prismaCode)) {
    mapped = [503, "DATABASE_UNAVAILABLE", "Cơ sở dữ liệu chưa sẵn sàng."];
  } else if (info.codes.some((code) => ["P2002", "23505"].includes(code))) {
    mapped = [409, "UNIQUE_CONSTRAINT", "Dữ liệu đã tồn tại."];
  } else if (info.codes.some((code) => ["P2003", "P2014", "23503", "23001"].includes(code))) {
    mapped = [409, "FOREIGN_KEY_CONSTRAINT", "Thao tác xung đột với dữ liệu liên quan."];
  } else if (info.codes.some((code) => ["P2001", "P2015", "P2025"].includes(code))) {
    mapped = [404, "RECORD_NOT_FOUND", "Không tìm thấy dữ liệu."];
  } else if (info.sqlState === "23514") {
    // Observed on Prisma 7.10.1 as P2039 + meta.driverAdapterError.cause.
    mapped = [422, "CHECK_CONSTRAINT", "Dữ liệu không thỏa điều kiện cho phép."];
  } else if (info.codes.some((code) => ["P2000", "P2011", "23502", "22001", "22003", "22P02"].includes(code))) {
    mapped = [422, "INVALID_DATA", "Dữ liệu không hợp lệ."];
  } else {
    mapped = [500, "INTERNAL_ERROR", "Lỗi máy chủ."];
  }
  const [status, code, message] = mapped;
  return { status, code, message, diagnostic: { prismaCode: info.prismaCode, sqlState: info.sqlState } };
}
