import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, assertNoDbError } from "@/server/http";
import { toCard, toNovelDetail, toParagraphs } from "@/server/presenters";
import { getChapter, listChapters } from "./chapters";
import { listNovels, getNovel } from "./novels";

// Dữ liệu đã định dạng sẵn cho các trang (Server Components).

const CARD_FIELDS = [
  "novel_id, title, slug, description, cover_url, status, vip, upper18",
  "count_like, last_chapter_at, created_at",
  "genres(genre_id, name, slug)",
  "interact_novel(view)",
  "reviews(rating)",
  "bookshelves(count)",
].join(", ");
const SECTION_SIZE = 15;
// Đủ cho toàn bộ dữ liệu hiện tại (60 truyện). Khi dữ liệu lớn hơn nhiều, nên chuyển
// các phép xếp hạng bên dưới thành view/RPC trong Postgres thay vì tính ở đây.
const HOME_POOL_SIZE = 300;

const average = (reviews) => (reviews?.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0);
const time = (value) => (value ? new Date(value).getTime() : 0);

function shuffle(items, seed) {
  // Xáo trộn có seed theo ngày: mục "Dành cho bạn"/"Bất ngờ" đổi mỗi ngày nhưng ổn định trong ngày.
  const result = [...items];
  let state = seed;
  for (let i = result.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function getHomeSections() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("novels")
    .select(CARD_FIELDS)
    .eq("published", true)
    .order("last_chapter_at", { ascending: false, nullsFirst: false })
    .limit(HOME_POOL_SIZE);
  assertNoDbError(error);

  const novels = data;
  const today = Math.floor(Date.now() / 864e5);
  const top = (compare) => [...novels].sort(compare).slice(0, SECTION_SIZE);

  // "Khám phá theo tâm trạng": một thể loại đổi theo ngày.
  const genres = [...new Map(novels.flatMap((n) => n.genres).map((g) => [g.slug, g])).values()];
  const moodGenre = genres.length ? shuffle(genres, today + 7)[0] : null;

  const sections = [
    { key: "trending", title: "Trending", items: top((a, b) => (b.interact_novel?.view ?? 0) - (a.interact_novel?.view ?? 0)) },
    { key: "for-you", title: "For you", items: shuffle(novels, today).slice(0, SECTION_SIZE) },
    { key: "top-rated", title: "Top rated", items: top((a, b) => average(b.reviews) - average(a.reviews) || b.reviews.length - a.reviews.length) },
    { key: "most-followed", title: "Most Followed", items: top((a, b) => (b.bookshelves[0]?.count ?? 0) - (a.bookshelves[0]?.count ?? 0)) },
    { key: "mood", title: "Mood Discovery", items: moodGenre ? novels.filter((n) => n.genres.some((g) => g.slug === moodGenre.slug)).slice(0, SECTION_SIZE) : [] },
    { key: "latest", title: "Newly updated", items: top((a, b) => time(b.last_chapter_at) - time(a.last_chapter_at)) },
    { key: "surprise", title: "Surprise", items: shuffle(novels, today + 13).slice(0, SECTION_SIZE) },
  ];

  return sections.map((section) => ({ ...section, items: section.items.map(toCard) }));
}

// Nhận slug hoặc tên thể loại (navbar cũ dùng tên tiếng Việt trên URL).
export async function getGenrePage(slugOrName) {
  const supabase = createAdminClient();
  const value = decodeURIComponent(slugOrName).trim();
  const { data: genres, error } = await supabase.from("genres").select("genre_id, name, slug");
  assertNoDbError(error);
  const lower = value.toLocaleLowerCase("vi");
  const genre = genres.find((g) => g.slug === lower || g.name.toLocaleLowerCase("vi") === lower);
  if (!genre) return { genre: null, novels: [] };

  const { items } = await listNovels({ from: 0, to: 99, genre: genre.slug, sort: "popular" });
  return { genre, novels: items.map(toCard) };
}

export async function searchNovels(q, { limit = 50 } = {}) {
  const { items } = await listNovels({ from: 0, to: limit - 1, q: q || undefined, sort: q ? "title" : "popular" });
  return items.map(toCard);
}

const isMissing = (error) => error instanceof ApiError && (error.status === 404 || error.status === 400);

// Trả null nếu truyện không tồn tại hoặc chưa xuất bản.
export const getNovelDetail = cache(async (idOrSlug) => {
  let novel;
  try {
    novel = await getNovel(idOrSlug);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  const supabase = createAdminClient();
  const [chapters, reviews] = await Promise.all([
    listChapters(String(novel.novel_id)),
    supabase.from("reviews").select("rating").eq("novel_id", novel.novel_id),
  ]);
  assertNoDbError(reviews.error);
  return toNovelDetail(novel, chapters, reviews.data);
});

// Dữ liệu cho trang đọc: truyện + danh sách chương (không nội dung) + nội dung chương hiện tại.
export const getReaderData = cache(async (idOrSlug, chapterNumber) => {
  if (!/^[1-9]\d*$/.test(String(chapterNumber))) return null;
  const novel = await getNovelDetail(idOrSlug);
  if (!novel) return null;
  let chapter;
  try {
    chapter = await getChapter(idOrSlug, Number(chapterNumber));
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  const summary = novel.chapters.find((item) => item.number === chapter.chapter_number);
  return { novel, chapter: { ...summary, paragraphs: toParagraphs(chapter.content) } };
});
