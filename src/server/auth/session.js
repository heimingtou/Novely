import "server-only";
import { cookies } from "next/headers";
import { REMEMBER_TTL_SECONDS, SESSION_COOKIE, SESSION_TTL_SECONDS, signSessionToken } from "./token";

// Ghi / xoá cookie phiên. Chỉ gọi trong Server Action hoặc Route Handler.
// httpOnly: JavaScript trên trình duyệt không đọc được token (chống XSS lấy cắp phiên).
// sameSite=lax: trình duyệt không gửi cookie trong request POST từ site khác (chống CSRF).
export async function createSession(user, { remember = false } = {}) {
  const ttl = remember ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS;
  const token = await signSessionToken({ userId: user.user_id, role: user.role }, ttl);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
