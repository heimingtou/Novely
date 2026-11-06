export const DEFAULT_SETTINGS = Object.freeze({
  font: "serif", fontSize: 20, width: 740, lineHeight: 1.9,
  theme: "sepia", brightness: 100, showProgress: true,
});

export const READER_FONTS = Object.freeze([
  { value: "serif", label: "Noto Serif · Có chân", family: "var(--font-reader-serif)" },
  { value: "book", label: "Palatino", family: '"Palatino Linotype", Palatino, var(--font-reader-serif)' },
  { value: "bookerly", label: "Bookerly", family: '"Bookerly", var(--font-reader-serif)' },
  { value: "be-vietnam", label: "Be Vietnam Pro", family: "var(--font-reader-vietnam)" },
  { value: "montserrat", label: "Montserrat", family: "var(--font-reader-montserrat)" },
  { value: "sans", label: "Arial", family: "Arial, Helvetica, sans-serif" },
  { value: "times", label: "Times New Roman", family: '"Times New Roman", var(--font-reader-serif)' },
]);

function clampNumber(value, fallback, min, max) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value)) : fallback;
}

export function normalizeSettings(value) {
  const data = value && typeof value === "object" ? value : {};
  return {
    font: READER_FONTS.some((font) => font.value === data.font) ? data.font : DEFAULT_SETTINGS.font,
    fontSize: clampNumber(data.fontSize, DEFAULT_SETTINGS.fontSize, 16, 32),
    width: clampNumber(data.width, DEFAULT_SETTINGS.width, 560, 1000),
    lineHeight: clampNumber(data.lineHeight, DEFAULT_SETTINGS.lineHeight, 1.4, 2.4),
    theme: ["light", "sepia", "dark"].includes(data.theme) ? data.theme : DEFAULT_SETTINGS.theme,
    brightness: clampNumber(data.brightness, 100, 70, 110),
    showProgress: typeof data.showProgress === "boolean" ? data.showProgress : true,
  };
}

export function normalizePosition(value, chapters) {
  if (!value || typeof value !== "object") return null;
  const chapter = chapters.find((item) => item.number === value.chapterNumber);
  if (!chapter?.paragraphs.some((paragraph) => paragraph.id === value.paragraphId)) return null;
  return {
    chapterNumber: chapter.number, paragraphId: value.paragraphId,
    fraction: clampNumber(value.fraction, 0, 0, 1),
    percent: clampNumber(value.percent, 0, 0, 100),
  };
}

export function normalizeBookmarks(value, paragraphs) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => paragraphs.some((p) => p.id === id)))];
}

export function normalizeAnnotations(value, paragraphs) {
  if (!Array.isArray(value)) return [];
  const accepted = [];
  for (const item of value.slice(0, 200)) {
    const paragraph = paragraphs.find((p) => p.id === item?.paragraphId);
    if (!paragraph || typeof item.id !== "string" || !Number.isInteger(item.start)
      || !Number.isInteger(item.end) || item.start < 0 || item.end > paragraph.text.length
      || item.start >= item.end || accepted.some((a) => a.id === item.id
        || (a.paragraphId === item.paragraphId && a.start < item.end && item.start < a.end))) continue;
    // Bỏ annotation cũ nếu nội dung gốc đã thay đổi, tránh đánh dấu nhầm câu.
    const quote = paragraph.text.slice(item.start, item.end);
    if (quote !== item.quote) continue;
    accepted.push({ id: item.id, paragraphId: item.paragraphId, start: item.start,
      end: item.end, quote, note: typeof item.note === "string" ? item.note.slice(0, 1000) : "" });
  }
  return accepted;
}

export function textSegments(text, annotations) {
  const sorted = [...annotations].sort((a, b) => a.start - b.start);
  const result = [];
  let cursor = 0;
  for (const annotation of sorted) {
    if (annotation.start > cursor) result.push({ text: text.slice(cursor, annotation.start) });
    result.push({ text: text.slice(annotation.start, annotation.end), annotation });
    cursor = annotation.end;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor) });
  return result;
}

export function normalizeComments(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, 100).filter((item) => {
    if (!item || typeof item.id !== "string" || seen.has(item.id)
      || typeof item.name !== "string" || !item.name.trim()
      || typeof item.text !== "string" || !item.text.trim()
      || typeof item.date !== "string" || !Number.isFinite(Date.parse(item.date))) return false;
    seen.add(item.id);
    return true;
  }).map((item) => ({ id: item.id, name: item.name.slice(0, 40), text: item.text.slice(0, 1500), date: item.date }));
}

export function normalizeReaction(value) {
  return ["love", "like", "wow"].includes(value) ? value : null;
}

export function readingPercent(index, fraction, count) {
  return count > 0 ? Math.round(Math.min(1, Math.max(0, (index + fraction) / count)) * 100) : 0;
}
