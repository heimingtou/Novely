export const WRITER_STORAGE_KEY = "novely:v1:writer";
export const WRITER_GENRES = [
  "Ngôn Tình", "Đam Mỹ", "Bách Hợp", "Tiên Hiệp", "Kiếm Hiệp",
  "Huyền Huyễn", "Đô Thị", "Khoa Huyễn", "Trọng Sinh", "Xuyên Không",
  "Hệ Thống", "Trinh Thám", "Kinh Dị", "Hài Hước", "Trường Học",
  "Cổ Đại", "Mạt Thế", "Dinh Dưỡng", "Võ Luyện", "Lịch Sử",
];
export const EMPTY_WRITER = Object.freeze({ version: 1, novels: [] });

const MAX_NOVELS = 100;
const MAX_CHAPTERS = 500;
const MAX_COVER_LENGTH = 1_100_000;
const MAX_CHAPTER_CONTENT = 50_000;
const record = (value) => value && typeof value === "object" && !Array.isArray(value);
const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validId = (id) => typeof id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(id);
const validDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const validCover = (value) => typeof value === "string"
  && value.length <= MAX_COVER_LENGTH
  && /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/]+=*$/.test(value);

export function normalizeWriterState(value) {
  const data = record(value) ? value : {};
  const ids = new Set();
  const novels = [];

  for (const item of (Array.isArray(data.novels) ? data.novels : []).slice(0, MAX_NOVELS)) {
    const title = clean(item?.title, 120);
    const description = clean(item?.description, 3000);
    const genres = [...new Set((Array.isArray(item?.genres) ? item.genres : [])
      .filter((genre) => WRITER_GENRES.includes(genre)))];
    if (!record(item) || !validId(item.id) || ids.has(item.id) || !title || !description
      || !genres.length || !validCover(item.coverImage) || !validDate(item.createdAt)) continue;

    ids.add(item.id);
    const chapterIds = new Set();
    const chapters = (Array.isArray(item.chapters) ? item.chapters : []).slice(0, MAX_CHAPTERS)
      .filter((chapter) => {
        if (!record(chapter) || !validId(chapter.id) || chapterIds.has(chapter.id)
          || !clean(chapter.title, 150) || !clean(chapter.content, MAX_CHAPTER_CONTENT)
          || !validDate(chapter.createdAt)) return false;
        chapterIds.add(chapter.id);
        return true;
      })
      .map((chapter, index) => ({
        id: chapter.id,
        number: index + 1,
        title: clean(chapter.title, 150),
        content: clean(chapter.content, MAX_CHAPTER_CONTENT),
        createdAt: chapter.createdAt,
      }));

    novels.push({
      id: item.id,
      title,
      genres,
      coverImage: item.coverImage,
      description,
      createdAt: item.createdAt,
      updatedAt: validDate(item.updatedAt) ? item.updatedAt : item.createdAt,
      chapters,
    });
  }

  return { version: 1, novels };
}

export function validateNovelInput(input) {
  const errors = {};
  if (!clean(input?.title, 120)) errors.title = "Vui lòng nhập tiêu đề truyện.";
  else if (input.title.length > 120) errors.title = "Tiêu đề truyện tối đa 120 ký tự.";
  const genres = Array.isArray(input?.genres) ? input.genres.filter((genre) => WRITER_GENRES.includes(genre)) : [];
  if (!genres.length) errors.genres = "Vui lòng chọn ít nhất một thể loại.";
  if (!validCover(input?.coverImage)) errors.cover = "Vui lòng chọn ảnh bìa PNG, JPG hoặc WebP (tối đa 750 KB).";
  if (!clean(input?.description, 3000)) errors.description = "Vui lòng nhập phần giới thiệu truyện.";
  else if (input.description.length > 3000) errors.description = "Giới thiệu tối đa 3.000 ký tự.";
  return errors;
}

export function validateChapterInput(input) {
  const errors = {};
  if (!clean(input?.title, 150)) errors.title = "Vui lòng nhập tên chương.";
  else if (input.title.length > 150) errors.title = "Tên chương tối đa 150 ký tự.";
  if (!clean(input?.content, MAX_CHAPTER_CONTENT)) errors.content = "Vui lòng nhập nội dung chương.";
  else if (input.content.length > MAX_CHAPTER_CONTENT) errors.content = "Nội dung chương tối đa 50.000 ký tự.";
  return errors;
}

export function createWriterNovel(state, input, id, now) {
  if (Object.keys(validateNovelInput(input)).length || !validId(id) || !validDate(now)) return state;
  const current = normalizeWriterState(state);
  if (current.novels.length >= MAX_NOVELS || current.novels.some((novel) => novel.id === id)) return state;
  return normalizeWriterState({
    ...current,
    novels: [{
      id,
      title: input.title,
      genres: input.genres,
      coverImage: input.coverImage,
      description: input.description,
      createdAt: now,
      updatedAt: now,
      chapters: [],
    }, ...current.novels],
  });
}

export function updateWriterNovel(state, novelId, input, now) {
  if (Object.keys(validateNovelInput(input)).length || !validDate(now)) return state;
  const current = normalizeWriterState(state);
  if (!current.novels.some((novel) => novel.id === novelId)) return state;

  return normalizeWriterState({
    ...current,
    novels: current.novels.map((novel) => novel.id === novelId
      ? {
          ...novel,
          title: input.title,
          genres: input.genres,
          description: input.description,
          updatedAt: now,
        }
      : novel),
  });
}

export function addWriterChapter(state, novelId, input, id, now) {
  if (Object.keys(validateChapterInput(input)).length || !validId(id) || !validDate(now)) return state;
  const current = normalizeWriterState(state);
  const novel = current.novels.find((item) => item.id === novelId);
  if (!novel || novel.chapters.length >= MAX_CHAPTERS
    || novel.chapters.some((chapter) => chapter.id === id)) return state;

  return normalizeWriterState({
    ...current,
    novels: current.novels.map((item) => item.id === novelId
      ? {
          ...item,
          updatedAt: now,
          chapters: [...item.chapters, { id, title: input.title, content: input.content, createdAt: now }],
        }
      : item),
  });
}

export function updateWriterChapter(state, novelId, chapterId, input, now) {
  if (Object.keys(validateChapterInput(input)).length || !validDate(now)) return state;
  const current = normalizeWriterState(state);
  const novel = current.novels.find((item) => item.id === novelId);
  if (!novel?.chapters.some((chapter) => chapter.id === chapterId)) return state;

  return normalizeWriterState({
    ...current,
    novels: current.novels.map((item) => item.id === novelId
      ? {
          ...item,
          updatedAt: now,
          chapters: item.chapters.map((chapter) => chapter.id === chapterId
            ? { ...chapter, title: input.title, content: input.content }
            : chapter),
        }
      : item),
  });
}

export function deleteWriterChapter(state, novelId, chapterId, now) {
  if (!validDate(now)) return state;
  const current = normalizeWriterState(state);
  const novel = current.novels.find((item) => item.id === novelId);
  if (!novel?.chapters.some((chapter) => chapter.id === chapterId)) return state;

  return normalizeWriterState({
    ...current,
    novels: current.novels.map((item) => item.id === novelId
      ? {
          ...item,
          updatedAt: now,
          chapters: item.chapters.filter((chapter) => chapter.id !== chapterId),
        }
      : item),
  });
}
