import { ok, withErrorHandling } from "@/server/http";
import { listGenres } from "@/server/services/genres";

// GET /api/genres
export const GET = withErrorHandling(async () => ok(await listGenres()));
