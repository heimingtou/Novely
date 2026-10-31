import test from "node:test";
import assert from "node:assert/strict";
import {
  addWriterChapter,
  createWriterNovel,
  EMPTY_WRITER,
  normalizeWriterState,
  validateChapterInput,
  validateNovelInput,
  WRITER_GENRES,
} from "../src/lib/writer-model.mjs";

const novelInput = {
  title: "Truyện mới",
  genres: ["Kinh Dị", "Bí Ẩn Không Hợp Lệ"],
  coverImage: "data:image/png;base64,AA==",
  description: "Giới thiệu truyện.",
};
const chapterInput = { title: "Chương đầu", content: "Nội dung chương đầu." };

test("có đủ 20 thể loại và chuẩn hóa lựa chọn thể loại", () => {
  assert.equal(WRITER_GENRES.length, 20);
  const state = createWriterNovel(EMPTY_WRITER, novelInput, "novel-1", "2026-10-28T00:00:00.000Z");
  assert.deepEqual(state.novels[0].genres, ["Kinh Dị"]);
});

test("không tạo truyện nếu thiếu thông tin hoặc id không hợp lệ", () => {
  assert.ok(validateNovelInput({ ...novelInput, genres: [] }).genres);
  assert.ok(validateNovelInput({ ...novelInput, coverImage: "" }).cover);
  assert.strictEqual(createWriterNovel(EMPTY_WRITER, { ...novelInput, title: "" }, "novel-1", "2026-10-28T00:00:00.000Z"), EMPTY_WRITER);
  assert.strictEqual(createWriterNovel(EMPTY_WRITER, novelInput, "bad id", "2026-10-28T00:00:00.000Z"), EMPTY_WRITER);
});

test("lưu truyện và thêm chương tuần tự", () => {
  const created = createWriterNovel(EMPTY_WRITER, novelInput, "novel-1", "2026-10-28T00:00:00.000Z");
  const withChapter = addWriterChapter(created, "novel-1", chapterInput, "chapter-1", "2026-10-28T00:01:00.000Z");
  assert.equal(withChapter.novels[0].chapters.length, 1);
  assert.equal(withChapter.novels[0].chapters[0].number, 1);
  assert.equal(withChapter.novels[0].chapters[0].content, chapterInput.content);
  assert.equal(withChapter.novels[0].updatedAt, "2026-10-28T00:01:00.000Z");
  assert.ok(validateChapterInput({ ...chapterInput, content: "  " }).content);
});

test("bỏ qua dữ liệu truyện và chương lưu trữ không hợp lệ", () => {
  const state = normalizeWriterState({
    novels: [
      { ...novelInput, id: "novel-1", createdAt: "2026-10-28T00:00:00.000Z", chapters: [
        { id: "chapter-1", title: "Chương", content: "Nội dung", createdAt: "2026-10-28T00:00:00.000Z" },
        { id: "chapter-1", title: "Trùng", content: "Bị bỏ", createdAt: "2026-10-28T00:00:00.000Z" },
      ] },
      { ...novelInput, id: "novel-2", coverImage: "https://example.com/cover.jpg", createdAt: "2026-10-28T00:00:00.000Z" },
    ],
  });
  assert.equal(state.novels.length, 1);
  assert.equal(state.novels[0].chapters.length, 1);
});
