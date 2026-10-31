import test from "node:test";
import assert from "node:assert/strict";
import {
  addWriterChapter,
  createWriterNovel,
  deleteWriterChapter,
  deleteWriterNovel,
  EMPTY_WRITER,
  normalizeWriterState,
  updateWriterChapter,
  updateWriterNovel,
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

test("sửa và xóa chương cập nhật thứ tự, thời gian của truyện", () => {
  const created = createWriterNovel(EMPTY_WRITER, novelInput, "novel-1", "2026-10-28T00:00:00.000Z");
  const withFirst = addWriterChapter(created, "novel-1", chapterInput, "chapter-1", "2026-10-28T00:01:00.000Z");
  const withTwo = addWriterChapter(
    withFirst,
    "novel-1",
    { title: "Chương hai", content: "Nội dung chương hai." },
    "chapter-2",
    "2026-10-28T00:02:00.000Z",
  );
  const edited = updateWriterChapter(
    withTwo,
    "novel-1",
    "chapter-2",
    { title: "Chương hai đã sửa", content: "Nội dung đã sửa." },
    "2026-10-28T00:03:00.000Z",
  );
  assert.equal(edited.novels[0].chapters[1].title, "Chương hai đã sửa");
  assert.equal(edited.novels[0].chapters[1].createdAt, "2026-10-28T00:02:00.000Z");
  assert.equal(edited.novels[0].updatedAt, "2026-10-28T00:03:00.000Z");

  const deleted = deleteWriterChapter(edited, "novel-1", "chapter-1", "2026-10-28T00:04:00.000Z");
  assert.equal(deleted.novels[0].chapters.length, 1);
  assert.equal(deleted.novels[0].chapters[0].id, "chapter-2");
  assert.equal(deleted.novels[0].chapters[0].number, 1);
  assert.equal(deleted.novels[0].updatedAt, "2026-10-28T00:04:00.000Z");
  assert.strictEqual(deleteWriterChapter(deleted, "novel-1", "missing", "2026-10-28T00:05:00.000Z"), deleted);
  assert.strictEqual(updateWriterChapter(deleted, "novel-1", "chapter-2", { title: "", content: "" }, "2026-10-28T00:05:00.000Z"), deleted);
});

test("sửa thông tin truyện giữ nguyên bìa và chương, cập nhật thời gian", () => {
  const created = createWriterNovel(EMPTY_WRITER, novelInput, "novel-1", "2026-10-28T00:00:00.000Z");
  const withChapter = addWriterChapter(created, "novel-1", chapterInput, "chapter-1", "2026-10-28T00:01:00.000Z");
  const updated = updateWriterNovel(withChapter, "novel-1", {
    ...withChapter.novels[0],
    title: "Tên truyện đã sửa",
    genres: ["Tiên Hiệp"],
    description: "Mô tả đã sửa.",
  }, "2026-10-28T00:02:00.000Z");

  assert.equal(updated.novels[0].title, "Tên truyện đã sửa");
  assert.deepEqual(updated.novels[0].genres, ["Tiên Hiệp"]);
  assert.equal(updated.novels[0].description, "Mô tả đã sửa.");
  assert.equal(updated.novels[0].coverImage, novelInput.coverImage);
  assert.deepEqual(updated.novels[0].chapters, withChapter.novels[0].chapters);
  assert.equal(updated.novels[0].updatedAt, "2026-10-28T00:02:00.000Z");
  assert.strictEqual(updateWriterNovel(updated, "missing", novelInput, "2026-10-28T00:03:00.000Z"), updated);
  assert.strictEqual(updateWriterNovel(updated, "novel-1", { ...novelInput, genres: [] }, "2026-10-28T00:03:00.000Z"), updated);
});

test("xóa truyện tự tạo khỏi writer store và giữ nguyên các truyện khác", () => {
  const first = createWriterNovel(EMPTY_WRITER, novelInput, "novel-1", "2026-10-28T00:00:00.000Z");
  const second = createWriterNovel(first, { ...novelInput, title: "Truyện khác" }, "novel-2", "2026-10-28T00:01:00.000Z");
  const deleted = deleteWriterNovel(second, "novel-1");

  assert.deepEqual(deleted.novels.map((novel) => novel.id), ["novel-2"]);
  assert.strictEqual(deleteWriterNovel(deleted, "missing"), deleted);
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
