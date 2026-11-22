import { ok, withErrorHandling } from "@/server/http";
import { listChapters } from "@/server/services/chapters";

// GET /api/novels/:id/chapters — danh sách chương đã xuất bản (không kèm nội dung)
export const GET = withErrorHandling(async (_request, { params }) => {
  const { id } = await params;
  return ok(await listChapters(id));
});
