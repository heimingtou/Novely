import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, assertNoDbError, notFound } from "@/server/http";
import { removeImage, uploadImage } from "@/server/storage";
import { FALLBACK_COVER, formatDate } from "@/server/presenters";
import { retryDeadlockedQuery } from "@/server/retry-deadlock.mjs";

// Quản lý truyện của tác giả. MỌI hàm nhận `user` lấy từ phiên đăng nhập (DAL) và kiểm tra
// quyền sở hữu trước khi đọc/ghi — không bao giờ tin author_id do client gửi lên.

export const COVER_MAX_BYTES = 750 * 1024;
const forbidden = () => new ApiError(403, "FORBIDDEN", "Bạn không có quyền chỉnh sửa truyện này.");
const db = () => createAdminClient();
const now = () => new Date().toISOString();

function unaccent(value) {
  return value.replace(/đ/g, "d").replace(/Đ/g, "D").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function slugify(value) {
  return unaccent(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "truyen";
}

async function uniqueSlug(title, exceptNovelId = null) {
  const base = slugify(title);
  const { data, error } = await db().from("novels").select("novel_id, slug").like("slug", `${base}%`);
  assertNoDbError(error);
  const taken = new Set(data.filter((row) => row.novel_id !== exceptNovelId).map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i += 1) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

const countWords = (content) => content.trim().split(/\s+/).filter(Boolean).length;

// ---------------------------------------------------------------- quyền sở hữu

async function ownNovel(user, novelId, fields = "novel_id, author_id") {
  const id = Number(novelId);
  if (!Number.isInteger(id) || id <= 0) throw notFound("Không tìm thấy truyện");
  const { data, error } = await db().from("novels").select(fields).eq("novel_id", id).maybeSingle();
  assertNoDbError(error);
  if (!data) throw notFound("Không tìm thấy truyện");
  if (data.author_id !== user.id && user.role !== "admin") throw forbidden();
  return data;
}

async function ownChapter(user, novelId, chapterId) {
  const novel = await ownNovel(user, novelId);
  const id = Number(chapterId);
  const { data, error } = Number.isInteger(id) && id > 0
    ? await db().from("chapters").select("chapter_id, chapter_number, status, published_at").eq("chapter_id", id).eq("novel_id", novel.novel_id).maybeSingle()
    : { data: null, error: null };
  assertNoDbError(error);
  if (!data) throw notFound("Không tìm thấy chương");
  return { novel, chapter: data };
}

// Cột tổng hợp của novels không có trigger: tự tính lại sau mỗi thay đổi chương.
// Truyện chỉ hiển thị công khai khi có ít nhất 1 chương đã xuất bản.
async function refreshNovelCounters(novelId) {
  const { data, error } = await db().from("chapters").select("published_at").eq("novel_id", novelId).eq("status", "published");
  assertNoDbError(error);
  const lastChapterAt = data.map((row) => row.published_at).filter(Boolean).sort().at(-1) ?? null;
  const { error: updateError } = await db().from("novels").update({
    count_chapter: data.length,
    last_chapter_at: lastChapterAt,
    published: data.length > 0,
    updated_at: now(),
  }).eq("novel_id", novelId);
  assertNoDbError(updateError);
}

// ---------------------------------------------------------------- đọc

export async function listGenreOptions() {
  const { data, error } = await db().from("genres").select("genre_id, name, slug").order("name");
  assertNoDbError(error);
  return data;
}

export async function listMyNovels(user) {
  const { data, error } = await db()
    .from("novels")
    .select("novel_id, title, slug, cover_url, status, published, updated_at, count_like, count_chapter, interact_novel(view), chapters(chapter_id, chapter_number, title, status, count_comment)")
    .eq("author_id", user.id)
    .order("updated_at", { ascending: false });
  assertNoDbError(error);
  return data.map((novel) => {
    const chapters = [...novel.chapters].sort((a, b) => a.chapter_number - b.chapter_number);
    return {
      id: novel.novel_id,
      slug: novel.slug,
      href: novel.published ? `/novels/${novel.slug}` : `/Writer/novels/${novel.novel_id}`,
      img: novel.cover_url || FALLBACK_COVER,
      title: novel.title,
      status: novel.status,
      published: novel.published,
      publish_date: novel.updated_at,
      views: novel.interact_novel?.view ?? 0,
      likes: novel.count_like,
      comments: chapters.reduce((sum, chapter) => sum + chapter.count_comment, 0),
      current_chapters: novel.count_chapter,
      chapters: chapters.map((chapter) => ({ id: chapter.chapter_id, number: chapter.chapter_number, title: chapter.title, status: chapter.status })),
    };
  });
}

export async function getMyNovel(user, novelId) {
  const novel = await ownNovel(user, novelId, "novel_id, author_id, title, slug, description, cover_url, status, published, genres(genre_id, name)");
  const { data: chapters, error } = await db()
    .from("chapters")
    .select("chapter_id, chapter_number, title, status, published_at, word_count")
    .eq("novel_id", novel.novel_id)
    .order("chapter_number");
  assertNoDbError(error);
  return {
    id: novel.novel_id,
    slug: novel.slug,
    title: novel.title,
    description: novel.description ?? "",
    coverImage: novel.cover_url || FALLBACK_COVER,
    status: novel.status,
    published: novel.published,
    genreIds: novel.genres.map((genre) => genre.genre_id),
    genres: novel.genres.map((genre) => genre.name),
    chapters: chapters.map((chapter) => ({
      id: chapter.chapter_id,
      number: chapter.chapter_number,
      title: chapter.title,
      status: chapter.status,
      date: formatDate(chapter.published_at),
      wordCount: chapter.word_count,
    })),
  };
}

export async function getMyChapter(user, novelId, chapterId) {
  const { chapter } = await ownChapter(user, novelId, chapterId);
  const { data, error } = await db()
    .from("chapters")
    .select("chapter_id, chapter_number, title, status, chapter_contents(content)")
    .eq("chapter_id", chapter.chapter_id)
    .single();
  assertNoDbError(error);
  const contents = Array.isArray(data.chapter_contents) ? data.chapter_contents[0] : data.chapter_contents;
  return { id: data.chapter_id, number: data.chapter_number, title: data.title, status: data.status, content: contents?.content ?? "" };
}

// ---------------------------------------------------------------- ghi

async function setGenres(novelId, genreIds) {
  const { error } = await db().from("novel_genres").delete().eq("novel_id", novelId);
  assertNoDbError(error);
  const { error: insertError } = await db().from("novel_genres").insert(genreIds.map((genre_id) => ({ novel_id: novelId, genre_id })));
  if (insertError?.code === "23503") throw new ApiError(400, "BAD_GENRE", "Thể loại không hợp lệ.");
  assertNoDbError(insertError);
}

export async function createNovel(user, { title, description, genreIds, status, coverFile }) {
  const coverUrl = await uploadImage("covers", coverFile, { prefix: String(user.id), maxBytes: COVER_MAX_BYTES });
  const { data, error } = await db().from("novels").insert({
    author_id: user.id,
    title,
    slug: await uniqueSlug(title),
    description,
    status,
    cover_url: coverUrl,
    published: false, // xuất bản khi có chương đầu tiên
  }).select("novel_id").single();
  if (error) {
    await removeImage("covers", coverUrl);
    assertNoDbError(error);
  }
  await setGenres(data.novel_id, genreIds);
  // Seed quy ước tác giả có role 'author'; người đọc đăng truyện đầu tiên sẽ thành tác giả.
  if (user.role === "reader") await db().from("users").update({ role: "author" }).eq("user_id", user.id);
  return data.novel_id;
}

export async function updateNovel(user, novelId, { title, description, genreIds, status, coverFile }) {
  const novel = await ownNovel(user, novelId, "novel_id, author_id, title, cover_url");
  const coverUrl = coverFile ? await uploadImage("covers", coverFile, { prefix: String(user.id), maxBytes: COVER_MAX_BYTES }) : novel.cover_url;
  const { error } = await db().from("novels").update({
    title,
    // Giữ nguyên slug (link đã chia sẻ không bị hỏng) trừ khi đổi tiêu đề.
    ...(title !== novel.title && { slug: await uniqueSlug(title, novel.novel_id) }),
    description,
    status,
    cover_url: coverUrl,
    updated_at: now(),
  }).eq("novel_id", novel.novel_id);
  assertNoDbError(error);
  await setGenres(novel.novel_id, genreIds);
  if (coverUrl !== novel.cover_url) await removeImage("covers", novel.cover_url);
}

// Next.js Writer remains the primary chapter-content writer during transition.
// Each retry below covers one aborted PostgREST transaction, never this workflow.
// Keep the legacy child-first deletion order; some FKs still use NO ACTION.
async function deleteChapterRows(chapterIds) {
  if (!chapterIds.length) return;
  const steps = [
    () => db().from("comments").delete().in("chapter_id", chapterIds),
    () => db().from("chapter_likes").delete().in("chapter_id", chapterIds),
    () => db().from("reading_progress").update({ chapter_id: null }).in("chapter_id", chapterIds),
    () => db().from("chapter_contents").delete().in("chapter_id", chapterIds),
    () => db().from("chapters").delete().in("chapter_id", chapterIds),
  ];
  for (const step of steps) assertNoDbError((await retryDeadlockedQuery(step)).error);
}

export async function deleteNovel(user, novelId) {
  const novel = await ownNovel(user, novelId, "novel_id, author_id, cover_url");
  const { data: chapters, error } = await db().from("chapters").select("chapter_id").eq("novel_id", novel.novel_id);
  assertNoDbError(error);
  await deleteChapterRows(chapters.map((chapter) => chapter.chapter_id));
  for (const table of ["reading_progress", "novel_genres", "novel_likes", "bookshelves", "reviews", "interact_novel", "interact_novel_day"]) {
    assertNoDbError((await db().from(table).delete().eq("novel_id", novel.novel_id)).error);
  }
  assertNoDbError((await db().from("novels").delete().eq("novel_id", novel.novel_id)).error);
  await removeImage("covers", novel.cover_url);
}

export async function saveChapter(user, novelId, chapterId, { title, content, publish }) {
  const status = publish ? "published" : "draft";
  const wordCount = countWords(content);

  if (chapterId) {
    const { novel, chapter } = await ownChapter(user, novelId, chapterId);
    const { error } = await retryDeadlockedQuery(() => db().from("chapters").update({
      title,
      word_count: wordCount,
      status,
      published_at: publish ? chapter.published_at ?? now() : null,
      updated_at: now(),
    }).eq("chapter_id", chapter.chapter_id));
    assertNoDbError(error);
    assertNoDbError((await retryDeadlockedQuery(() => db().from("chapter_contents").upsert({ chapter_id: chapter.chapter_id, content }))).error);
    await refreshNovelCounters(novel.novel_id);
    return chapter.chapter_id;
  }

  const novel = await ownNovel(user, novelId);
  const { data: last, error: lastError } = await db().from("chapters").select("chapter_number")
    .eq("novel_id", novel.novel_id).order("chapter_number", { ascending: false }).limit(1).maybeSingle();
  assertNoDbError(lastError);
  const { data, error } = await retryDeadlockedQuery(() => db().from("chapters").insert({
    novel_id: novel.novel_id,
    chapter_number: (last?.chapter_number ?? 0) + 1,
    title,
    word_count: wordCount,
    status,
    published_at: publish ? now() : null,
  }).select("chapter_id").single());
  assertNoDbError(error);
  const { error: contentError } = await retryDeadlockedQuery(() => db().from("chapter_contents").insert({ chapter_id: data.chapter_id, content }));
  if (contentError) {
    await retryDeadlockedQuery(() => db().from("chapters").delete().eq("chapter_id", data.chapter_id));
    assertNoDbError(contentError);
  }
  await refreshNovelCounters(novel.novel_id);
  return data.chapter_id;
}

export async function deleteChapter(user, novelId, chapterId) {
  const { novel, chapter } = await ownChapter(user, novelId, chapterId);
  await deleteChapterRows([chapter.chapter_id]);
  await refreshNovelCounters(novel.novel_id);
}

// ---------------------------------------------------------------- thống kê

const percentSegments = (pairs) => {
  const total = pairs.reduce((sum, [, value]) => sum + value, 0);
  return total ? pairs.filter(([, value]) => value > 0).map(([label, value]) => ({ label, value: Math.round((value / total) * 1000) / 10 })) : [];
};

export async function getNovelStatistics(user, novelId) {
  const novel = await ownNovel(user, novelId, "novel_id, author_id, title, cover_url, count_chapter, interact_novel(*)");
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 864e5);
    return date.toISOString().slice(0, 10);
  });

  const [chapters, daily, readers] = await Promise.all([
    db().from("chapters").select("chapter_id, chapter_number, count_view, count_like, count_comment")
      .eq("novel_id", novel.novel_id).eq("status", "published").order("chapter_number").limit(30),
    db().from("interact_novel_day").select("day, count_view, count_like").eq("novel_id", novel.novel_id).gte("day", days[0]),
    db().from("reading_progress").select("user_id", { head: true, count: "exact" }).eq("novel_id", novel.novel_id),
  ]);
  for (const result of [chapters, daily, readers]) assertNoDbError(result.error);

  const chapterIds = chapters.data.map((chapter) => chapter.chapter_id);
  const { data: comments, error } = chapterIds.length
    ? await db().from("comments").select("created_at").in("chapter_id", chapterIds).gte("created_at", days[0]).is("deleted_at", null)
    : { data: [], error: null };
  assertNoDbError(error);

  const byDay = new Map(daily.data.map((row) => [row.day, row]));
  const commentsByDay = comments.reduce((map, row) => map.set(row.created_at.slice(0, 10), (map.get(row.created_at.slice(0, 10)) ?? 0) + 1), new Map());
  const stats = novel.interact_novel ?? {};

  return {
    title: novel.title,
    img: novel.cover_url || FALLBACK_COVER,
    readers: readers.count ?? 0,
    views: stats.view ?? 0,
    chapters: novel.count_chapter,
    daily: {
      dates: days.map((day) => `${day.slice(8, 10)}/${day.slice(5, 7)}`),
      readers: days.map((day) => byDay.get(day)?.count_view ?? 0),
      votes: days.map((day) => byDay.get(day)?.count_like ?? 0),
      comments: days.map((day) => commentsByDay.get(day) ?? 0),
    },
    chapterEngagement: {
      chapters: chapters.data.map((chapter) => `Chương ${chapter.chapter_number}`),
      reads: chapters.data.map((chapter) => chapter.count_view),
      votes: chapters.data.map((chapter) => chapter.count_like),
      comments: chapters.data.map((chapter) => chapter.count_comment),
    },
    demographics: {
      age: percentSegments([
        ["Dưới 18", stats.under_eighteen ?? 0],
        ["18–35", stats.eighteen_to_thirty_five ?? 0],
        ["Trên 35", stats.over_thirty_five ?? 0],
        ["Chưa rõ", stats.age_unknown ?? 0],
      ]),
      gender: percentSegments([
        ["Nam", stats.male ?? 0],
        ["Nữ", stats.female ?? 0],
        ["Khác / chưa rõ", stats.gender_other ?? 0],
      ]),
    },
  };
}

