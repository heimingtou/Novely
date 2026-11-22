import "server-only";

// Chuyển dữ liệu từ Supabase sang đúng dạng mà các component giao diện đang dùng
// (trước đây lấy từ src/data/novels.mjs và faker), để không phải sửa giao diện.

export const FALLBACK_COVER = "/CardStory.jpg";
const NEW_CHAPTER_DAYS = 3;
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
});

export function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "";
}

// 12870 -> "12.9K", 2400000 -> "2.4M"
export function formatCount(value = 0) {
  const number = Number(value) || 0;
  if (number >= 1e6) return `${(number / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (number >= 1e3) return `${(number / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return String(number);
}

export function averageRating(reviews) {
  if (!reviews?.length) return null;
  return Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10;
}

const genreNames = (novel) => (novel.genres ?? []).map((genre) => genre.name);
const views = (novel) => novel.interact_novel?.view ?? 0;

// Dạng cho CardStory / ListStory / HeroCarousel.
export function toCard(novel) {
  return {
    id: novel.slug,
    title: novel.title,
    description: novel.description ?? "",
    likes: formatCount(views(novel)), // CardStory hiển thị cạnh icon con mắt => lượt xem
    hearts: formatCount(novel.count_like),
    genres: genreNames(novel).join(", "),
    coverImage: novel.cover_url || FALLBACK_COVER,
    badges: { full: novel.status === "completed", age18: novel.upper18, vip: novel.vip },
  };
}

// Mỗi đoạn có id theo vị trí (p1, p2...). Bookmark/highlight lưu theo id này và
// được kiểm tra lại bằng nội dung trích dẫn, nên sửa chương không gây đánh dấu nhầm.
export function toParagraphs(content = "") {
  return content
    .split(/\n\s*\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: `p${index + 1}`, text }));
}

export function toChapterSummary(chapter) {
  const publishedAt = chapter.published_at ? new Date(chapter.published_at) : null;
  return {
    number: chapter.chapter_number,
    title: chapter.title.replace(/^Chương\s+\d+\s*:\s*/i, ""),
    date: formatDate(chapter.published_at),
    isNew: Boolean(publishedAt && Date.now() - publishedAt.getTime() < NEW_CHAPTER_DAYS * 864e5),
  };
}

// Dạng cho trang chi tiết truyện và trang đọc.
export function toNovelDetail(novel, chapters, reviews = []) {
  return {
    id: novel.slug,
    title: novel.title,
    author: novel.author?.username ?? "",
    authorId: novel.author?.user_id ?? null,
    description: novel.description ?? "",
    coverImage: novel.cover_url || FALLBACK_COVER,
    tags: genreNames(novel),
    status: novel.status,
    rating: averageRating(reviews),
    reviewCount: reviews.length,
    views: formatCount(views(novel)),
    likes: formatCount(novel.count_like),
    chapters: chapters.map(toChapterSummary),
  };
}
