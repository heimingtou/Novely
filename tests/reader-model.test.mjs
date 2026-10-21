import test from "node:test";
import assert from "node:assert/strict";
import { getNovel, getChapter, chapterHref } from "../src/data/novels.mjs";
import { DEFAULT_SETTINGS, READER_FONTS, normalizeSettings, normalizePosition, normalizeBookmarks, normalizeAnnotations, textSegments, normalizeComments, normalizeReaction, readingPercent } from "../src/lib/reader-model.mjs";

const novel = getNovel("demo");
const chapter = getChapter(novel, "1");

test("URL không được chọn nhầm chương từ một giá trị gần đúng", () => {
  for (const number of ["01", "1abc", "1.5", "-1", "999", "Infinity"]) assert.equal(getChapter(novel, number), undefined);
  assert.equal(getChapter(getNovel("missing"), "1"), undefined);
  assert.equal(chapterHref("truyện a", 2), "/novels/truy%E1%BB%87n%20a/chapters/2");
});

test("mỗi chương và đoạn có định danh riêng, không thiếu nội dung", () => {
  assert.equal(new Set(novel.chapters.map((item) => item.number)).size, novel.chapters.length);
  const paragraphs = novel.chapters.flatMap((item) => item.paragraphs);
  assert.equal(new Set(paragraphs.map((item) => item.id)).size, paragraphs.length);
  assert.ok(paragraphs.every((item) => item.text.trim().length > 0));
});

test("thiết lập hỏng được trả về mặc định, số vượt biên được giới hạn", () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ fontSize: 999, width: -1, font: "url(evil)", theme: "unknown", brightness: Infinity, lineHeight: NaN, showProgress: "false" }),
    { ...DEFAULT_SETTINGS, fontSize: 32, width: 560 });
  assert.equal(normalizeSettings({ showProgress: false }).showProgress, false);
});

test("tiến độ phải trỏ tới đúng đoạn của đúng chương", () => {
  assert.equal(normalizePosition({ chapterNumber: 2, paragraphId: chapter.paragraphs[0].id }, novel.chapters), null);
  assert.equal(normalizePosition({ chapterNumber: 999, paragraphId: "missing" }, novel.chapters), null);
  assert.deepEqual(normalizePosition({ chapterNumber: 1, paragraphId: chapter.paragraphs[2].id, fraction: 5, percent: -20 }, novel.chapters),
    { chapterNumber: 1, paragraphId: chapter.paragraphs[2].id, fraction: 1, percent: 0 });
});

test("font bổ sung được giữ khi đọc lại thiết lập, các khóa font cũ vẫn hợp lệ", () => {
  assert.equal(new Set(READER_FONTS.map((font) => font.value)).size, READER_FONTS.length);
  for (const font of ["serif", "sans", "book", "bookerly", "be-vietnam", "montserrat", "times"]) {
    assert.equal(normalizeSettings({ font }).font, font);
  }
});

test("bookmark bỏ trùng và không nhận đoạn thuộc chương khác", () => {
  const id = chapter.paragraphs[0].id;
  assert.deepEqual(normalizeBookmarks([id, id, novel.chapters[1].paragraphs[0].id, null], chapter.paragraphs), [id]);
});

test("highlight Unicode không làm mất hoặc nhân đôi văn bản; bỏ vùng trùng và vùng cũ", () => {
  const paragraphs = [{ id: "p", text: "Ánh trăng 🌙 trên mái nhà" }];
  const text = paragraphs[0].text;
  const first = { id: "a", paragraphId: "p", start: 0, end: 9, quote: text.slice(0, 9), note: "Ghi chú" };
  const second = { id: "b", paragraphId: "p", start: 10, end: 12, quote: text.slice(10, 12) };
  const accepted = normalizeAnnotations([first, second, { ...first, id: "overlap", start: 1 }, { ...first, id: "changed", quote: "nội dung cũ" }, { ...first, id: "bounds", end: 9999 }, null], paragraphs);
  assert.equal(accepted.length, 2);
  assert.equal(textSegments(text, accepted).map((item) => item.text).join(""), text);
  assert.equal(textSegments(text, accepted)[0].annotation.note, "Ghi chú");
  assert.equal(normalizeAnnotations([first], [{ id: "p", text: "Đã sửa văn bản" }]).length, 0);
});

test("bình luận thiếu dữ liệu, trùng id hoặc ngày không hợp lệ bị loại", () => {
  const valid = { id: "a", name: "An", text: "<script>không thực thi</script>", date: "2026-10-21T00:00:00Z" };
  const result = normalizeComments([null, valid, valid, { ...valid, id: "b", date: "invalid" }, { ...valid, id: "c", text: "  " }]);
  assert.deepEqual(result, [valid]);
  assert.equal(normalizeReaction("invalid"), null);
});

test("phần trăm đọc nằm trong 0–100 kể cả ở ngoài nội dung", () => {
  assert.equal(readingPercent(0, 0, 12), 0);
  assert.equal(readingPercent(5, 1, 12), 50);
  assert.equal(readingPercent(11, 1, 12), 100);
  assert.equal(readingPercent(99, 1, 12), 100);
  assert.equal(readingPercent(0, 0, 0), 0);
});
