import { test, expect } from "@playwright/test";

async function language(page, name) {
  const menu = page.locator("#account-menu");
  if (!await menu.isVisible()) await page.locator(".avatar > button").click();
  await menu.getByRole("button", { name, exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", name === "English" ? "en" : "vi");
  await expect.poll(async () => (await page.context().cookies()).find(cookie => cookie.name === "novely-locale")?.value).toBe(name === "English" ? "en" : "vi");
}

test("nhãn tiếng Việt thống nhất, chuyển Anh áp dụng cả trang server và giữ sau reload", async ({ page }) => {
  await page.goto("/novels/demo");
  await expect(page.getByRole("button", { name: "Thêm vào thư viện", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).first().click();
  await page.locator(".avatar > button").click();
  for (const name of ["Hồ sơ", "Góc tác giả", "Cài đặt", "Đăng xuất"]) await expect(page.locator("#account-menu").getByRole("button", { name, exact: true })).toBeVisible();
  await language(page, "English");
  await expect(page.getByRole("heading", { name: "Story details", exact: true })).toBeVisible();
  await expect(page.locator("#account-menu").getByRole("button", { name: "Profile", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to library", exact: true })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "For you", exact: true })).toBeVisible();
  await page.goto("/search");
  await expect(page.getByPlaceholder("Search stories")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Recommended stories" })).toBeVisible();
  await language(page, "Tiếng Việt");
  await expect(page.getByRole("heading", { name: "Đề xuất truyện" })).toBeVisible();
});

test("trang đọc dịch công cụ và cài đặt, giữ nguyên truyện, dấu trang và cỡ chữ", async ({ page }) => {
  await page.goto("/novels/demo/chapters/1");
  const paragraph = page.locator("[data-reader-paragraph]").first();
  const original = await paragraph.textContent();
  await page.getByRole("button", { name: "Đánh dấu đoạn 1", exact: true }).click();
  await language(page, "English");
  await expect(page.getByRole("button", { name: "My clippings", exact: true })).toBeVisible();
  await expect(page.locator(".reader-back-label small")).toHaveText("Chapter 1");
  await expect(paragraph).toHaveText(original);
  await expect(page.getByRole("button", { name: "Bookmark paragraph 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.locator(".avatar > button").click();
  await page.getByRole("button", { name: "Reading settings", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Enter font size", exact: true }).fill("25");
  await page.getByRole("spinbutton", { name: "Enter font size", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Close settings", exact: true }).click();
  await page.reload();
  await expect(page.locator(".reader-prose")).toHaveCSS("font-size", "25px");
  await expect(paragraph).toHaveText(original);
  await language(page, "Tiếng Việt");
  await expect(page.getByRole("button", { name: "Trích đoạn của tôi", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đánh dấu đoạn 1", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("Forum chuyển chủ đề và thao tác, không dịch bài viết hoặc bản nháp", async ({ page, context }) => {
  await page.goto("/forum");
  const original = await page.locator(".forum-post-title").first().textContent();
  await language(page, "English");
  await expect(page.getByRole("link", { name: "Latest", exact: true })).toBeVisible();
  await expect(page.locator(".forum-post-title").first()).toHaveText(original);
  await page.locator(".avatar > button").click();
  await page.locator(".forum-page-heading").getByRole("button", { name: "Create post", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create post" });
  await dialog.getByLabel("Title", { exact: true }).fill("My story: tiếng Việt 🌙");
  await dialog.getByLabel("Content", { exact: true }).fill("Giữ nguyên nội dung tự viết.");
  await dialog.getByLabel("Topic", { exact: true }).selectOption("theory");
  await expect(dialog.getByLabel("Topic", { exact: true })).toHaveValue("theory");
  const other = await context.newPage();
  await other.goto("/forum");
  await language(other, "Tiếng Việt");
  const translatedDialog = page.getByRole("dialog", { name: "Tạo bài viết" });
  await expect(translatedDialog.getByLabel("Tiêu đề", { exact: true })).toHaveValue("My story: tiếng Việt 🌙");
  await expect(translatedDialog.getByRole("textbox", { name: "Nội dung", exact: true })).toHaveValue("Giữ nguyên nội dung tự viết.");
  await expect(translatedDialog.getByLabel("Chủ đề", { exact: true })).toHaveValue("theory");
  await translatedDialog.getByRole("button", { name: "Đóng hộp thoại" }).click();
  await expect(page.getByRole("navigation", { name: "Chủ đề cộng đồng" }).getByRole("link", { name: /^Giả thuyết/ })).toBeVisible();
});

test("ngôn ngữ đồng bộ hai tab và giữ giao diện tối", async ({ page, context }) => {
  await page.goto("/forum");
  await page.locator(".avatar > button").click();
  const toggle = page.getByRole("switch", { name: "Chế độ tối" });
  if (await toggle.getAttribute("aria-checked") === "false") await toggle.click();
  const other = await context.newPage();
  await other.goto("/novels/demo");
  await language(page, "English");
  await expect(other.locator("html")).toHaveAttribute("lang", "en");
  await expect(other.getByRole("heading", { name: "Story details", exact: true })).toBeVisible();
  await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
  await other.reload();
  await expect(other.getByRole("heading", { name: "Story details", exact: true })).toBeVisible();
});

test("chuyển ngôn ngữ bằng bàn phím trên điện thoại và khi storage bị chặn", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
  });
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/novels/demo");
  await page.locator(".avatar > button").click();
  const english = page.getByRole("button", { name: "English", exact: true });
  await english.focus();
  await english.press("Enter");
  await expect(page.getByRole("heading", { name: "Story details", exact: true })).toBeVisible();
  const box = await page.locator("#account-menu").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/locale-menu-mobile.png" });
});
