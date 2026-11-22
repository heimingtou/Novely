import { badRequest, ok, parsePagination, withErrorHandling } from "@/server/http";
import { listNovels, NOVEL_STATUSES } from "@/server/services/novels";

// GET /api/novels?page=1&limit=20&status=ongoing&genre=tien-hiep&q=kiếm&sort=latest|newest|popular|title
export const GET = withErrorHandling(async (request) => {
  const { searchParams } = request.nextUrl;
  const pagination = parsePagination(searchParams);
  const status = searchParams.get("status") || undefined;
  if (status && !NOVEL_STATUSES.includes(status)) throw badRequest(`status phải là: ${NOVEL_STATUSES.join(", ")}`);

  const { items, total } = await listNovels({
    ...pagination,
    status,
    genre: searchParams.get("genre") || undefined,
    q: searchParams.get("q")?.trim() || undefined,
    sort: searchParams.get("sort") || undefined,
  });

  return ok(items, {
    meta: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) },
  });
});
