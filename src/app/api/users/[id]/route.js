import { ok, withErrorHandling } from "@/server/http";
import { getPublicProfile } from "@/server/services/users";

// GET /api/users/:id  (id số hoặc username) — hồ sơ công khai + truyện đã đăng
export const GET = withErrorHandling(async (_request, { params }) => {
  const { id } = await params;
  return ok(await getPublicProfile(id));
});
