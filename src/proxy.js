import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/token";

// Kiểm tra lạc quan (chỉ xác minh chữ ký + hạn của token, không gọi DB) để chuyển hướng sớm.
// Quyền thật sự vẫn được kiểm tra lại trong DAL (src/server/auth/dal.js) ở page và Server Action.
const PROTECTED_PREFIXES = ["/Writer"];

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    const url = new URL("/auth", request.nextUrl);
    url.searchParams.set("next", pathname + search);
    const response = NextResponse.redirect(url);
    // Token hỏng/hết hạn thì xoá luôn cho sạch.
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/Writer/:path*"],
};
