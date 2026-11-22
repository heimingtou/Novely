import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNoDbError, badRequest, notFound } from "@/server/http";

// Chỉ chọn cột công khai của tác giả: KHÔNG lấy email, password_hash.
const AUTHOR = "author:users!fk_novels_author(user_id, username, profile:profiles(avatar))";
const NOVEL_FIELDS = [
  "novel_id, title, slug, description, cover_url, status, vip, upper18",
  "count_chapter, count_like, last_chapter_at, created_at, updated_at",
  AUTHOR,
  "genres(genre_id, name, slug)",
  "interact_novel(view)",
].join(", ");

export const NOVEL_STATUSES = ["ongoing", "completed"];
const SORTS = {
  latest: { column: "last_chapter_at", ascending: false },
  newest: { column: "created_at", ascending: false },
  popular: { column: "count_like", ascending: false },
  title: { column: "title", ascending: true },
};

export async function listNovels({ from, to, status, genre, q, sort = "latest" } = {}) {
  const supabase = createAdminClient();
  // Lọc theo thể loại cần inner join để loại truyện không thuộc thể loại đó.
  const fields = genre ? NOVEL_FIELDS.replace("genres(", "genres!inner(") : NOVEL_FIELDS;

  let query = supabase.from("novels").select(fields, { count: "exact" }).eq("published", true);
  if (status) query = query.eq("status", status);
  if (genre) query = query.eq("genres.slug", genre);
  if (q) query = query.ilike("title", `%${q.replace(/[%_,()]/g, " ")}%`);

  const order = SORTS[sort] ?? SORTS.latest;
  const { data, error, count } = await query
    .order(order.column, { ascending: order.ascending, nullsFirst: false })
    .range(from, to);
  assertNoDbError(error);
  return { items: data, total: count ?? 0 };
}

// Nhận novel_id (số) hoặc slug. Chỉ trả truyện đã xuất bản.
export const getNovel = cache(async (idOrSlug) => {
  const supabase = createAdminClient();
  const column = /^\d+$/.test(idOrSlug) ? "novel_id" : "slug";
  if (column === "slug" && !/^[a-z0-9-]+$/.test(idOrSlug)) throw badRequest("Slug không hợp lệ");

  const { data, error } = await supabase
    .from("novels")
    .select(NOVEL_FIELDS)
    .eq(column, idOrSlug)
    .eq("published", true)
    .maybeSingle();
  assertNoDbError(error);
  if (!data) throw notFound("Không tìm thấy truyện");
  return data;
});
