import { ok, withErrorHandling } from "@/server/http";
import { getNovel } from "@/server/services/novels";

// GET /api/novels/:id  (novel_id hoặc slug)
export const GET = withErrorHandling(async (_request, { params }) => {
  const { id } = await params;
  return ok(await getNovel(id));
});
