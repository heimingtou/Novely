import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNoDbError, notFound } from "@/server/http";
import { getNovel } from "./novels";

// Danh sách chương không kèm nội dung để phản hồi nhẹ.
const CHAPTER_SUMMARY = "chapter_id, chapter_number, title, word_count, count_view, count_like, count_comment, published_at";

export async function listChapters(novelIdOrSlug) {
  const novel = await getNovel(novelIdOrSlug);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("chapters")
    .select(CHAPTER_SUMMARY)
    .eq("novel_id", novel.novel_id)
    .eq("status", "published")
    .order("chapter_number", { ascending: true });
  assertNoDbError(error);
  return data;
}

export async function getChapter(novelIdOrSlug, chapterNumber) {
  const novel = await getNovel(novelIdOrSlug);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("chapters")
    .select(`${CHAPTER_SUMMARY}, chapter_contents(content)`)
    .eq("novel_id", novel.novel_id)
    .eq("chapter_number", chapterNumber)
    .eq("status", "published")
    .maybeSingle();
  assertNoDbError(error);
  if (!data) throw notFound("Không tìm thấy chương");

  // Số chương liền trước/sau để làm nút điều hướng trong trang đọc.
  const published = () =>
    supabase.from("chapters").select("chapter_number").eq("novel_id", novel.novel_id).eq("status", "published");
  const [prev, next] = await Promise.all([
    published().lt("chapter_number", chapterNumber).order("chapter_number", { ascending: false }).limit(1).maybeSingle(),
    published().gt("chapter_number", chapterNumber).order("chapter_number", { ascending: true }).limit(1).maybeSingle(),
  ]);
  assertNoDbError(prev.error || next.error);

  const { chapter_contents: contents, ...chapter } = data;
  // chapter_contents có thể về dạng object (1-1) hoặc mảng tuỳ khóa của bảng.
  const content = (Array.isArray(contents) ? contents[0] : contents)?.content ?? "";

  return {
    ...chapter,
    content,
    paragraphs: content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    novel: { novel_id: novel.novel_id, title: novel.title, slug: novel.slug },
    prev_chapter: prev.data?.chapter_number ?? null,
    next_chapter: next.data?.chapter_number ?? null,
  };
}
