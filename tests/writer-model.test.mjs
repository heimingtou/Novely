import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDrafts } from "../src/lib/writer-model.mjs";
import { getWriterStory, writerStories } from "../src/data/writer-stories.mjs";

test("truyện mẫu có ID ổn định và cùng nguồn với thống kê", () => {
  assert.equal(writerStories.length, 3);
  assert.equal(getWriterStory("1").title, "Hệ Thống Đọc Sách Nhận Thưởng");
  assert.equal(getWriterStory("__proto__"), undefined);
});
test("bản nháp bỏ dữ liệu hỏng và trùng, giữ Unicode, giới hạn độ dài", () => {
  const draft = { id: "draft-test", title: " Truyện 🌙 ", body: "<script>Tiếng Việt</script>", date: "2026-11-09T00:00:00Z" };
  assert.deepEqual(normalizeDrafts(null), []);
  const result = normalizeDrafts([null, {}, draft, draft, { ...draft, id: "unknown" }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Truyện 🌙");
  assert.equal(result[0].body, draft.body);
  assert.equal(normalizeDrafts([{ ...draft, title: "x".repeat(200), body: "x".repeat(60000) }])[0].body.length, 50000);
});
