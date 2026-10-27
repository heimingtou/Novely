import test from "node:test";
import assert from "node:assert/strict";
import { createTranslator, english, vietnamese } from "../src/lib/i18n/messages.mjs";
import { FORUM_CATEGORIES } from "../src/data/forum.mjs";

test("nhãn biên tập có đủ hai ngôn ngữ và không còn tên tính năng pha trộn", () => {
  for (const key of Object.keys(vietnamese)) assert.ok(english[key], `Missing English: ${key}`);
  const vi = createTranslator("vi");
  assert.equal(vi("profile"), "Hồ sơ");
  assert.equal(vi("My Clipping"), "Trích đoạn của tôi");
  assert.equal(vi("Mua gói Vip"), "Nâng cấp VIP");
  for (const category of FORUM_CATEGORIES) {
    assert.ok(english[category.name]);
    assert.ok(vietnamese[category.name]);
    assert.ok(english[category.description]);
  }
});

test("mẫu động giữ nguyên nội dung chèn vào và thông báo có thể đổi ngôn ngữ", () => {
  const en = createTranslator("en"), vi = createTranslator("vi");
  assert.equal(en("Chương {0}: {1}", [3, "Cuốn sách {0} <script>"]), "Chapter 3: Cuốn sách {0} <script>");
  assert.equal(en("Một câu chuyện tự viết"), "Một câu chuyện tự viết");
  assert.equal(en(vi("Đã lưu ghi chú cá nhân.")), "Personal note saved.");
  assert.equal(vi(en("Đã lưu ghi chú cá nhân.")), "Đã lưu ghi chú cá nhân.");
});
