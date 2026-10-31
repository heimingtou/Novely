import { test, expect } from "@playwright/test";

const chapterOne = "/novels/demo/chapters/1";
const prefix = "novely:v1:demo:chapter:1";
async function openReader(page, path = chapterOne) {
  await page.goto(path);
  await expect(page.getByRole("button", { name: "Cài đặt đọc", exact: true })).toBeEnabled();
}
async function readStored(page, key) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
}
async function selectText(page, start, end, pointer = true) {
  await page.locator("[data-reader-paragraph]").first().evaluate((paragraph, { start, end, pointer }) => {
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    function point(offset) {
      for (const node of nodes) {
        if (offset <= node.length) return [node, offset];
        offset -= node.length;
      }
      return [nodes.at(-1), nodes.at(-1).length];
    }
    const range = document.createRange();
    range.setStart(...point(start)); range.setEnd(...point(end));
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    if (pointer) paragraph.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    else document.dispatchEvent(new Event("selectionchange"));
  }, { start, end, pointer });
}

test("chi tiết có một danh sách, sắp xếp vẫn dẫn đúng chương", async ({ page }) => {
  await page.goto("/novels/demo");
  await expect(page.locator("#chapters")).toHaveCount(1);
  await page.getByRole("button", { name: "Cũ nhất", exact: true }).click();
  await expect(page.locator("#chapters a").first()).toHaveAttribute("href", "/novels/demo/chapters/3");
  await page.locator("#chapters a").first().click();
  await expect(page).toHaveURL(/\/chapters\/3$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cuốn sách không tên");
  await expect(page.getByRole("navigation", { name: "Điều hướng đầu chương" }).getByRole("button", { name: "Chương sau" })).toBeDisabled();
  await page.getByRole("navigation", { name: "Điều hướng đầu chương" }).getByRole("link", { name: "Chương trước" }).click();
  await expect(page).toHaveURL(/\/chapters\/2$/);
});

test("URL sai trả 404 và chương đầu không có chương trước", async ({ page }) => {
  await openReader(page);
  await expect(page.getByRole("navigation", { name: "Điều hướng đầu chương" }).getByRole("button", { name: "Chương trước" })).toBeDisabled();
  for (const url of ["/novels/missing/chapters/1", "/novels/demo/chapters/999", "/novels/demo/chapters/1abc", "/novels/missing"]) {
    const response = await page.goto(url);
    expect(response.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Không tìm thấy");
  }
});

test("thiết lập đọc được lưu và khôi phục sau tải lại", async ({ page }) => {
  await openReader(page);
  await page.getByRole("button", { name: "Cài đặt đọc", exact: true }).click();
  await page.getByLabel("Phông chữ", { exact: true }).selectOption("sans");
  await page.getByLabel("Nền đọc", { exact: true }).selectOption("dark");
  for (const [label, steps] of [["Cỡ chữ", 10], ["Giãn dòng", 8], ["Độ rộng tối đa", 17], ["Độ sáng vùng đọc", 3]]) {
    const slider = page.getByRole("slider", { name: label, exact: true });
    await slider.focus();
    await slider.press("Home");
    for (let step = 0; step < steps; step += 1) await slider.press("ArrowRight");
  }
  await page.getByLabel("Hiện phần trăm đã đọc").uncheck();
  await page.reload();
  await expect(page.locator(".novely-reader")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".reader-prose")).toHaveCSS("font-size", "26px");
  await expect(page.locator(".reader-prose")).toHaveCSS("filter", "brightness(0.85)");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page.getByRole("button", { name: "Cài đặt đọc", exact: true }).click();
  await expect(page.getByLabel("Phông chữ", { exact: true })).toHaveValue("sans");
  await expect(page.getByLabel(/Độ rộng tối đa/)).toHaveValue("900");
  await page.getByRole("button", { name: "Mặc định", exact: true }).click();
  await expect(page.locator(".novely-reader")).toHaveAttribute("data-theme", "sepia");
});

test("tự lưu đoạn, khôi phục sau reload, đọc tiếp và đọc từ đầu", async ({ page }) => {
  await openReader(page);
  const id = "c1-chiec-the";
  await page.locator(`#paragraph-${id}`).evaluate((element) => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 150));
  await expect.poll(async () => (await readStored(page, `${prefix}:position`))?.paragraphId).toBe(id);
  await page.reload();
  await expect.poll(() => page.locator(`#paragraph-${id}`).evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeGreaterThan(90);
  await expect.poll(() => page.locator(`#paragraph-${id}`).evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeLessThan(200);
  await page.locator(".reader-back").click();
  await page.getByRole("link", { name: "Đọc tiếp chương 1" }).click();
  await expect.poll(() => page.locator(`#paragraph-${id}`).evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeLessThan(200);
  await page.locator(".reader-back").click();
  await page.getByRole("link", { name: "Đọc từ đầu", exact: true }).click();
  await expect.poll(async () => (await readStored(page, `${prefix}:position`))?.paragraphId).toBe("c1-con-pho");
});

test("bookmark tồn tại sau reload và không lẫn giữa hai chương", async ({ page }) => {
  await openReader(page);
  await page.getByRole("button", { name: "Đánh dấu đoạn 3", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Đánh dấu đoạn 3", exact: true })).toHaveAttribute("aria-pressed", "true");
  await openReader(page, "/novels/demo/chapters/2");
  await expect(page.getByRole("button", { name: "Đánh dấu đoạn 3", exact: true })).toHaveAttribute("aria-pressed", "false");
  await openReader(page);
  await page.locator(".reader-notebook details").first().locator("summary").click();
  await page.getByRole("button", { name: "Bỏ đánh dấu đoạn 3", exact: true }).click();
  expect(await readStored(page, `${prefix}:bookmarks`)).toEqual([]);
});

test("highlight và ghi chú giữ đúng nội dung sau tải lại, có thể sửa và xóa", async ({ page }) => {
  await openReader(page);
  const paragraph = page.locator("[data-reader-paragraph]").first();
  const original = await paragraph.textContent();
  await paragraph.scrollIntoViewIfNeeded();
  await selectText(page, 0, 25);
  await page.getByLabel("Ghi chú cho văn bản đã chọn", { exact: true }).fill("Chi tiết mở đầu đáng nhớ");
  await page.getByRole("button", { name: "Lưu ghi chú", exact: true }).click();
  await expect(paragraph.locator("mark")).toHaveText(original.slice(0, 25));
  await expect(paragraph).toHaveText(original);
  await selectText(page, 30, 45);
  await page.getByRole("button", { name: "Tô sáng", exact: true }).click();
  await expect(paragraph.locator("mark")).toHaveCount(2);
  await expect(paragraph).toHaveText(original);
  await page.reload();
  await expect(paragraph.locator("mark")).toHaveCount(2);
  await page.locator(".reader-notebook details").nth(1).locator("summary").click();
  const firstNote = page.locator(".reader-note").first();
  await expect(firstNote.getByLabel("Ghi chú cá nhân")).toHaveValue("Chi tiết mở đầu đáng nhớ");
  await firstNote.getByLabel("Ghi chú cá nhân").fill("Đã sửa ghi chú");
  await firstNote.getByRole("button", { name: "Lưu ghi chú" }).click();
  expect((await readStored(page, `${prefix}:annotations`))[0].note).toBe("Đã sửa ghi chú");
  await firstNote.getByRole("button", { name: "Xóa phần tô sáng và ghi chú" }).click();
  await expect(paragraph.locator("mark")).toHaveCount(1);
});

test("bình luận, reaction lưu riêng từng chương và có thể xóa", async ({ page }) => {
  await openReader(page);
  await expect(page.getByRole("heading", { name: "Bình luận", exact: true })).toBeVisible();
  await expect(page.getByLabel("Tên hiển thị")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Gửi bình luận" })).toHaveCount(0);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).first().click();
  await expect(page.locator(".reader-comment-account")).toContainText("Bạn đọc Novely");
  await page.getByRole("button", { name: "Yêu thích", exact: true }).click();
  await page.getByLabel("Cảm nghĩ của bạn").fill("Một khởi đầu rất hay <script>alert(1)</script>");
  await page.getByRole("button", { name: "Gửi bình luận" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Yêu thích", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".reader-comment > p")).toContainText("<script>alert(1)</script>");
  await expect(page.locator(".reader-comment strong")).toHaveText("Bạn đọc Novely");
  await openReader(page, "/novels/demo/chapters/2");
  await expect(page.locator(".reader-comment")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Yêu thích", exact: true })).toHaveAttribute("aria-pressed", "false");
  await openReader(page);
  await page.getByRole("button", { name: "Xóa bình luận của Bạn đọc Novely" }).click();
  await expect(page.locator(".reader-comment")).toHaveCount(0);
  await page.locator(".avatar > button").click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đăng nhập để bình luận", exact: true })).toBeVisible();
  await expect(page.getByLabel("Cảm nghĩ của bạn")).toHaveCount(0);
});

test("danh sách chương xổ trong trang, không còn nút trùng chức năng", async ({ page }) => {
  await openReader(page, "/novels/demo/chapters/2");
  await expect(page.getByRole("button", { name: "Chọn chương", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mở My Clipping", exact: true })).toHaveCount(0);
  await expect(page.locator(".reader-toolbar-actions > button")).toHaveCount(3);
  await expect(page.locator(".reader-toolbar-actions > button").nth(1)).toHaveAccessibleName("Trích đoạn của tôi");
  await expect(page.locator(".reader-toolbar-actions > button").nth(2)).toHaveAccessibleName("Cài đặt đọc");
  for (const label of ["Điều hướng đầu chương", "Điều hướng cuối chương"]) {
    const navigation = page.getByRole("navigation", { name: label, exact: true });
    const trigger = navigation.getByRole("button", { name: "Danh sách chương", exact: true });
    await trigger.click();
    await expect(page).toHaveURL(/\/chapters\/2$/);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(navigation.locator('a[aria-current="page"]')).toContainText("Chương 2");
    const buttonBox = await trigger.boundingBox();
    const listBox = await navigation.locator(".reader-chapter-options").boundingBox();
    expect(listBox.y).toBeGreaterThanOrEqual(buttonBox.y + buttonBox.height);
    if (label === "Điều hướng đầu chương") {
      await trigger.click();
      await expect(navigation.locator(".reader-chapter-options")).toHaveCount(0);
    } else {
      await navigation.getByRole("link", { name: /Chương 3:/ }).click();
      await expect(page).toHaveURL(/\/chapters\/3$/);
      await expect(page.locator(".reader-back-label small")).toHaveText("Chương 3");
      const titleBox = await page.locator(".reader-back-label > span").boundingBox();
      const chapterBox = await page.locator(".reader-back-label small").boundingBox();
      expect(chapterBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
    }
  }
});

test("thanh công cụ sát hai bên và danh sách chương không tràn trên các cỡ màn hình", async ({ page }) => {
  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await openReader(page);
    const back = await page.locator(".reader-back").boundingBox();
    const actions = await page.locator(".reader-toolbar-actions").boundingBox();
    expect(back.x).toBeLessThanOrEqual(24);
    expect(width - actions.x - actions.width).toBeLessThanOrEqual(24);
    expect(back.x + back.width).toBeLessThanOrEqual(actions.x);
    const navigation = page.getByRole("navigation", { name: "Điều hướng đầu chương" });
    await navigation.getByRole("button", { name: "Danh sách chương" }).click();
    const list = await navigation.locator(".reader-chapter-options").boundingBox();
    expect(list.x).toBeGreaterThanOrEqual(0);
    expect(list.x + list.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("dữ liệu trình duyệt bị hỏng không làm trang đọc bị lỗi", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("novely:v1:settings", "{broken");
    localStorage.setItem("novely:v1:demo:chapter:1:position", JSON.stringify({ chapterNumber: 1, paragraphId: "removed" }));
    localStorage.setItem("novely:v1:demo:chapter:1:annotations", JSON.stringify([null, { start: -1 }]));
    localStorage.setItem("novely:v1:demo:chapter:1:comments", JSON.stringify([null]));
  });
  await openReader(page);
  await expect(page.locator(".novely-reader")).toHaveAttribute("data-theme", "sepia");
  await expect(page.locator("[data-reader-paragraph]")).toHaveCount(12);
  await expect(page.locator(".reader-comment")).toHaveCount(0);
});

test("localStorage bị chặn vẫn đọc và ghi chú được trong phiên", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
  });
  await openReader(page);
  await page.getByRole("button", { name: "Đánh dấu đoạn 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đánh dấu đoạn 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".reader-warning")).toContainText("chỉ được giữ trong phiên này");
});

test("màn hình điện thoại có thể đọc và mở cài đặt, không tràn ngang", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReader(page);
  await page.getByRole("button", { name: "Cài đặt đọc", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cài đặt đọc" })).toBeVisible();
  await page.getByRole("button", { name: "Đóng cài đặt" }).click();
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
  await page.screenshot({ path: "test-results/reader-mobile.png" });
});

test("cài đặt vẫn mở được giữa chương và đổi cỡ chữ giữ nguyên đoạn đọc", async ({ page }) => {
  await openReader(page);
  const paragraph = page.locator("#paragraph-c1-chiec-the");
  await paragraph.evaluate((element) => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 150));
  await expect.poll(async () => (await readStored(page, `${prefix}:position`))?.paragraphId).toBe("c1-chiec-the");
  await page.getByRole("button", { name: "Cài đặt đọc", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cài đặt đọc", exact: true })).toBeInViewport();
  const slider = page.getByRole("slider", { name: "Cỡ chữ", exact: true });
  await slider.press("End");
  await page.getByRole("button", { name: "Đóng cài đặt" }).click();
  await expect(paragraph).toHaveCSS("font-size", "32px");
  await expect.poll(() => paragraph.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeGreaterThan(80);
  await expect.poll(() => paragraph.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeLessThan(210);
});

test("bookmark đồng bộ giữa hai tab cùng trình duyệt", async ({ page, context }) => {
  await openReader(page);
  const second = await context.newPage();
  await openReader(second);
  await page.getByRole("button", { name: "Đánh dấu đoạn 2", exact: true }).click();
  await expect(second.getByRole("button", { name: "Đánh dấu đoạn 2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await second.close();
});

test("nghe truyện có tạm dừng, tiếp tục và hủy khi chuyển chương", async ({ page }) => {
  // Giả lập API thiết bị; không cần loa hoặc giọng Việt cài trên máy chạy test.
  await page.addInitScript(() => {
    window.__readerSpeech = { canceled: 0, paused: false, current: null };
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [{ lang: "vi-VN", name: "Test voice" }],
      speak: (utterance) => { window.__readerSpeech.current = utterance; setTimeout(() => utterance.onstart?.(), 0); },
      cancel: () => { window.__readerSpeech.canceled += 1; },
      pause: () => { window.__readerSpeech.paused = true; },
      resume: () => { window.__readerSpeech.paused = false; },
    } });
  });
  await openReader(page);
  await page.locator(".reader-speech > summary").click();
  await page.getByRole("button", { name: "Nghe từ đoạn hiện tại", exact: true }).click();
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  expect(await page.evaluate(() => window.__readerSpeech.paused)).toBe(true);
  await page.getByRole("button", { name: "Tiếp tục nghe", exact: true }).click();
  expect(await page.evaluate(() => window.__readerSpeech.paused)).toBe(false);
  await page.getByRole("navigation", { name: "Điều hướng đầu chương" }).getByRole("link", { name: "Chương sau" }).click();
  await expect(page).toHaveURL(/\/chapters\/2$/);
  await expect.poll(() => page.evaluate(() => window.__readerSpeech.canceled)).toBeGreaterThan(1);
});

test("trình duyệt thiếu Text-to-Speech vẫn đọc được văn bản", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined }));
  await openReader(page);
  await page.locator(".reader-speech > summary").click();
  await expect(page.getByRole("button", { name: "Nghe từ đoạn hiện tại", exact: true })).toBeDisabled();
  await expect(page.locator("[data-reader-paragraph]")).toHaveCount(12);
});

test("trang đọc desktop không có lỗi JavaScript khi mở và cuộn", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openReader(page);
  await page.screenshot({ path: "test-results/reader-desktop.png" });
  await page.locator("#paragraph-c1-trang-dau").scrollIntoViewIfNeeded();
  expect(errors).toEqual([]);
});

test("chọn chữ bằng selectionchange trên màn hình nhỏ vẫn ghi chú được", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReader(page);
  await page.locator("[data-reader-paragraph]").first().scrollIntoViewIfNeeded();
  await selectText(page, 0, 30, false);
  const note = page.getByLabel("Ghi chú cho văn bản đã chọn", { exact: true });
  await expect(note).toBeVisible();
  await note.pressSequentially("Ghi chú trên điện thoại", { delay: 20 });
  await expect(note).toHaveValue("Ghi chú trên điện thoại");
  await page.getByRole("button", { name: "Lưu ghi chú", exact: true }).click();
  await expect(page.locator("[data-reader-paragraph]").first().locator("mark")).toHaveCount(1);
});

test("font có chân dùng đủ glyph tiếng Việt từ font đóng gói, giữ thiết lập serif cũ", async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem("novely:v1:settings", JSON.stringify({ font: "serif", fontSize: 20 })));
  await openReader(page);
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: "Cài đặt đọc", exact: true }).click();
  await expect(page.getByRole("option", { name: "Noto Serif · Có chân" })).toHaveAttribute("value", "serif");
  await expect(page.getByLabel("Phông chữ", { exact: true })).toHaveValue("serif");
  await page.getByRole("button", { name: "Đóng cài đặt" }).click();

  const client = await context.newCDPSession(page);
  await client.send("DOM.enable");
  await client.send("CSS.enable");
  const { root } = await client.send("DOM.getDocument");
  const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "[data-reader-paragraph]" });
  for (const nodeId of nodeIds) {
    const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.every((font) => font.isCustomFont && /Noto.*Serif/i.test(font.familyName))).toBe(true);
  }
  await client.detach();
  await page.locator("[data-reader-paragraph]").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/reader-vietnamese-serif.png" });
});

test("Highlight tự thêm vào My Clipping của cả truyện, mở lại và xóa được", async ({ page }) => {
  await openReader(page);
  const paragraph = page.locator("[data-reader-paragraph]").first();
  const quoteOne = (await paragraph.textContent()).slice(0, 28);
  await paragraph.scrollIntoViewIfNeeded();
  await selectText(page, 0, 28);
  await expect(page.getByRole("region", { name: "Tô sáng và ghi chú văn bản đã chọn" })).toBeVisible();
  await page.getByRole("button", { name: "Tô sáng", exact: true }).click();
  await page.getByRole("button", { name: "Trích đoạn của tôi", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Trích đoạn của tôi", exact: true });
  await expect(dialog.locator(".reader-note")).toHaveCount(1);
  await expect(dialog.locator(".reader-note").first()).toContainText(quoteOne);
  await dialog.getByLabel("Ghi chú cá nhân").fill("Ghi chú trong My Clipping");
  await dialog.getByRole("button", { name: "Lưu ghi chú" }).click();
  await dialog.getByRole("button", { name: "Đóng trích đoạn của tôi" }).click();

  await openReader(page, "/novels/demo/chapters/2");
  await paragraph.scrollIntoViewIfNeeded();
  await selectText(page, 0, 25);
  await page.getByRole("button", { name: "Tô sáng", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Trích đoạn của tôi", exact: true }).click();
  await expect(dialog.locator(".reader-note")).toHaveCount(2);
  await expect(dialog.locator(".reader-clipping-chapter").first().getByLabel("Ghi chú cá nhân")).toHaveValue("Ghi chú trong My Clipping");
  await page.screenshot({ path: "test-results/reader-my-clipping.png" });
  await dialog.locator(".reader-clipping-chapter").first().getByRole("link").click();
  await expect(page).toHaveURL(/\/chapters\/1(?:#.*)?$/);
  await expect(paragraph.locator("mark")).toHaveText(quoteOne);
  await page.getByRole("button", { name: "Trích đoạn của tôi", exact: true }).click();
  await dialog.locator(".reader-clipping-chapter").first().getByRole("button", { name: "Xóa trích đoạn" }).click();
  await expect(dialog.locator(".reader-note")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Đóng trích đoạn của tôi" }).click();
  await expect(paragraph.locator("mark")).toHaveCount(0);
  await paragraph.scrollIntoViewIfNeeded();
  await selectText(page, 0, 28);
  await page.getByRole("button", { name: "Tô sáng", exact: true }).click();
  await page.getByRole("button", { name: "Đánh dấu đoạn 1", exact: true }).click();
  await page.getByRole("button", { name: "Trích đoạn của tôi", exact: true }).click();
  await expect(dialog.locator(".reader-note")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Xóa tất cả", exact: true }).click();
  await expect(dialog.locator(".reader-note")).toHaveCount(0);
  expect(await readStored(page, `${prefix}:annotations`)).toEqual([]);
  expect(await readStored(page, "novely:v1:demo:chapter:2:annotations")).toEqual([]);
  await dialog.getByRole("button", { name: "Đóng trích đoạn của tôi" }).click();
  await expect(paragraph.locator("mark")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Đánh dấu đoạn 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(paragraph.locator("mark")).toHaveCount(0);
});

test("nhập nhanh thông số đọc đồng bộ thanh trượt và giữ sau reload", async ({ page }) => {
  await openReader(page);
  await page.getByRole("button", { name: "Cài đặt đọc", exact: true }).click();
  for (const [name, value, slider] of [["Nhập cỡ chữ", "25", "Cỡ chữ"], ["Nhập giãn dòng", "2.2", "Giãn dòng"], ["Nhập độ rộng tối đa", "900", "Độ rộng tối đa"], ["Nhập độ sáng vùng đọc", "85", "Độ sáng vùng đọc"]]) {
    await page.getByRole("spinbutton", { name, exact: true }).fill(value);
    await page.getByRole("spinbutton", { name, exact: true }).press("Enter");
    await expect(page.getByRole("slider", { name: slider, exact: true })).toHaveValue(value);
  }
  await expect(page.locator(".reader-prose")).toHaveCSS("font-size", "25px");
  await page.reload();
  await page.getByRole("button", { name: "Cài đặt đọc", exact: true }).click();
  const size = page.getByRole("spinbutton", { name: "Nhập cỡ chữ", exact: true });
  await expect(size).toHaveValue("25");
  await size.fill("99"); await size.press("Enter");
  await expect(size).toHaveValue("32");
  await size.fill(""); await size.press("Enter");
  await expect(size).toHaveValue("32");
  await page.getByRole("button", { name: "Mặc định", exact: true }).click();
  await expect(size).toHaveValue("20");
  await page.screenshot({ path: "test-results/reader-number-settings.png" });
});

test("các font mới hiển thị tiếng Việt, lưu lựa chọn và có fallback Bookerly rõ ràng", async ({ page, context }) => {
  await openReader(page);
  await page.getByRole("button", { name: "Cài đặt đọc", exact: true }).click();
  const select = page.getByLabel("Phông chữ", { exact: true });
  for (const label of ["Palatino", "Bookerly", "Be Vietnam Pro", "Montserrat", "Arial", "Times New Roman"]) {
    await expect(select.getByRole("option", { name: label, exact: true })).toHaveCount(1);
  }
  const client = await context.newCDPSession(page);
  await client.send("DOM.enable"); await client.send("CSS.enable");
  for (const [font, family] of [["be-vietnam", /Be Vietnam Pro/i], ["montserrat", /Montserrat/i]]) {
    await select.selectOption(font);
    await page.evaluate(() => document.fonts.ready);
    const { root } = await client.send("DOM.getDocument");
    const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector: "[data-reader-paragraph]" });
    const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.every((item) => item.isCustomFont && family.test(item.familyName))).toBe(true);
  }
  await client.detach();
  await page.reload();
  await page.getByRole("button", { name: "Cài đặt đọc", exact: true }).click();
  await expect(select).toHaveValue("montserrat");
  await select.selectOption("bookerly");
  await expect(page.locator(".reader-font-note")).toContainText("Nếu chưa có, trang sẽ dùng Noto Serif");
});

test("vòng tròn tiến độ nổi tự tăng, khôi phục và bật tắt được", async ({ page }) => {
  await openReader(page);
  const progress = page.getByRole("progressbar", { name: "Tiến độ đọc chương", exact: true });
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await page.locator("#paragraph-c1-chiec-the").evaluate((element) => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 150));
  await expect.poll(async () => Number(await progress.getAttribute("aria-valuenow"))).toBeGreaterThan(50);
  const percent = Number(await progress.getAttribute("aria-valuenow"));
  const offset = Number(await progress.locator(".reader-progress-ring").getAttribute("stroke-dashoffset"));
  expect(offset).toBeLessThan(2 * Math.PI * 23);
  await expect(progress).toContainText(`${percent}%`);
  await page.reload();
  await expect.poll(async () => Number(await progress.getAttribute("aria-valuenow"))).toBeGreaterThan(50);
  await page.getByRole("button", { name: "Cài đặt đọc", exact: true }).click();
  await page.getByLabel("Hiện phần trăm đã đọc").uncheck();
  await expect(progress).toHaveCount(0);
  await page.getByLabel("Hiện phần trăm đã đọc").check();
  await page.getByRole("button", { name: "Đóng cài đặt" }).click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(progress).toHaveAttribute("aria-valuenow", "100");
  await page.screenshot({ path: "test-results/reader-floating-progress.png" });
});
