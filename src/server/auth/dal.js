import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, assertNoDbError } from "@/server/http";
import { SESSION_COOKIE, verifySessionToken } from "./token";

// Data Access Layer cho xác thực: MỌI kiểm tra quyền phía server đi qua đây.
// Proxy chỉ chặn sớm cho trải nghiệm tốt; quyết định cuối cùng luôn ở DAL.

export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
});

// Người dùng hiện tại (đọc lại từ DB mỗi request: tài khoản bị xoá thì phiên mất hiệu lực,
// đổi role có hiệu lực ngay). Chỉ trả các trường an toàn để đưa xuống client.
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await createAdminClient()
    .from("users")
    .select("user_id, username, role, profile:profiles(avatar)")
    .eq("user_id", session.userId)
    .maybeSingle();
  assertNoDbError(error);
  if (!data) return null;
  return {
    id: data.user_id,
    username: data.username,
    role: data.role,
    avatar: data.profile?.avatar ?? null,
    expiresAt: session.expiresAt,
  };
});

// Dùng trong Server Component/Page: chưa đăng nhập thì chuyển sang /auth rồi quay lại `next`.
export async function requireUser(next = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(next)}`);
  return user;
}

// Dùng trong Server Action / Route Handler: ném lỗi 401 thay vì redirect.
export async function assertUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Bạn cần đăng nhập để thực hiện thao tác này.");
  return user;
}
