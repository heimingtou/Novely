import { ok, parsePositiveInt, withErrorHandling } from "@/server/http";
import { getChapter } from "@/server/services/chapters";

// GET /api/novels/:id/chapters/:chapterNumber — nội dung một chương
export const GET = withErrorHandling(async (_request, { params }) => {
  const { id, chapterNumber } = await params;
  return ok(await getChapter(id, parsePositiveInt(chapterNumber, "chapterNumber")));
});
