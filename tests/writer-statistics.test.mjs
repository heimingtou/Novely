import test from "node:test";
import assert from "node:assert/strict";
import { createWriterStatistics } from "../src/lib/writer-statistics.mjs";

test("thống kê truyện mới dùng số liệu 0 và khớp chương hiện có", () => {
  const statistics = createWriterStatistics({
    title: "Truyện mới",
    coverImage: "data:image/png;base64,AA==",
    chapters: [
      { number: 1, title: "Chương đầu" },
      { number: 2, title: "Chương hai" },
    ],
  }, new Date(2026, 9, 31));

  assert.equal(statistics.title, "Truyện mới");
  assert.equal(statistics.img, "data:image/png;base64,AA==");
  assert.equal(statistics.readers, 0);
  assert.equal(statistics.views, 0);
  assert.equal(statistics.chapters, 2);
  assert.deepEqual(statistics.daily.dates, ["25/10", "26/10", "27/10", "28/10", "29/10", "30/10", "31/10"]);
  assert.deepEqual(statistics.daily.readers, [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(statistics.chapterEngagement.chapters, ["Chương 1", "Chương 2"]);
  assert.deepEqual(statistics.chapterEngagement.reads, [0, 0]);
  assert.deepEqual(statistics.demographics.age, []);
  assert.deepEqual(statistics.demographics.gender, []);
});
