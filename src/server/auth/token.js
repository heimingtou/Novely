import { SignJWT, jwtVerify } from "jose";

// Ký / xác minh token phiên (JWT HS256). Không import next/headers để dùng được cả trong proxy.

export const SESSION_COOKIE = "novely_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 1 ngày
export const REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 ngày khi chọn "Ghi nhớ đăng nhập"

let key;
function secretKey() {
  if (!key) {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32) throw new Error("AUTH_SECRET thiếu hoặc quá ngắn (cần >= 32 ký tự). Xem .env.example.");
    key = new TextEncoder().encode(secret);
  }
  return key;
}

export async function signSessionToken({ userId, role }, ttlSeconds) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secretKey());
}

// Trả { userId, role, expiresAt } hoặc null nếu token sai chữ ký / hết hạn / không có.
export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return { userId, role: payload.role, expiresAt: payload.exp * 1000 };
  } catch {
    return null;
  }
}
