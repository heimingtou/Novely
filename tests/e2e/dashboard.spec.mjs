import { test, expect } from "@playwright/test";

async function openWriter(page) {
  await page.goto("/Writer");
  await expect(page.getByRole("button", { name: "Đăng truyện mới", exact: true })).toBeEnabled();
}

test("chia sẻ mở đúng tác phẩm, không còn 404 và có nhãn truy cập", async ({ page, request }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async value => { window.__copied = value; } } });
  });
  await openWriter(page);
  for (const card of await page.locator(".ContaintCard").all()) {
    const title = await card.locator("h2").textContent();
    await card.getByRole("button", { name: "Chia sẻ", exact: true }).click();
    const url = await page.evaluate(() => window.__copied);
    const response = await request.get(url);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(title);
    await expect(card.getByRole("status")).toContainText("Đã sao chép");
  }
});

test("tạo bản nháp, mở lại và tiếp tục viết giữ nội dung qua reload", async ({ page }) => {
  await openWriter(page);
  await page.getByRole("button", { name: "Đăng truyện mới", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Đăng nhập để viết truyện" }).click();
  await dialog.getByLabel("Tên truyện", { exact: true }).fill("Bản nháp tiếng Việt 🌙");
  await dialog.getByLabel("Bản thảo", { exact: true }).fill("Nội dung <script>alert(1)</script>");
  await dialog.getByRole("button", { name: "Lưu bản nháp" }).click();
  const card = page.locator(".ContaintCard").filter({ hasText: "Bản nháp tiếng Việt 🌙" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Chia sẻ", exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "Tất cả truyện", exact: true }).click();
  await card.getByRole("button", { name: "Tiếp tục viết", exact: true }).click();
  await expect(dialog.getByLabel("Bản thảo", { exact: true })).toHaveValue("Nội dung <script>alert(1)</script>");
  await dialog.getByLabel("Bản thảo", { exact: true }).fill("Bản thảo đã sửa");
  await dialog.getByRole("checkbox", { name: "Truyện dài kỳ" }).check();
  await dialog.getByRole("button", { name: "Lưu bản nháp" }).click();
  await page.getByRole("tab", { name: "Series", exact: true }).click();
  await expect(card).toBeVisible();
  await page.locator(".ContaintCard").first().getByRole("button", { name: "Tiếp tục viết", exact: true }).click();
  await dialog.getByLabel("Bản thảo", { exact: true }).fill("Phần viết tiếp của truyện mẫu");
  await dialog.getByRole("button", { name: "Lưu bản nháp" }).click();
  await page.reload();
  await page.locator(".ContaintCard").first().getByRole("button", { name: "Tiếp tục viết", exact: true }).click();
  await expect(dialog.getByLabel("Bản thảo", { exact: true })).toHaveValue("Phần viết tiếp của truyện mẫu");
});

test("dashboard đổi ngôn ngữ, các tab hoạt động bằng chuột và bàn phím", async ({ page }) => {
  await page.goto("/Writer/statistics/1");
  await expect(page.locator(".statistics-chart-card")).toHaveCount(3);
  await page.getByRole("tab", { name: "Mức độ tương tác" }).click();
  await expect(page.locator(".statistics-bar-chart")).toHaveCount(3);
  await page.getByRole("tab", { name: "Đặc điểm độc giả" }).click();
  await expect(page.locator(".statistics-chart-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Menu tài khoản", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Audience", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Readers by gender" })).toBeVisible();
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("tab", { name: "Audience", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Engagement", exact: true })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName("Engagement");
  const valid = await page.locator(".statistics-bar-chart").evaluateAll(charts => charts.every(chart => !/NaN|Infinity/.test(chart.outerHTML)));
  expect(valid).toBe(true);
  await page.getByRole("link", { name: "Back to my stories" }).click();
  await expect(page.getByRole("heading", { name: "My stories", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Published" })).toBeVisible();
});

test("Writer và dashboard không tràn ngang ở mọi điểm gãy", async ({ page }) => {
  for (const route of ["/Writer", "/Writer/statistics/1"]) {
    await page.goto(route);
    for (const width of [320, 390, 610, 640, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: "test-results/dashboard-mobile-fixed.png" });
});

test("ID sai trả 404, ID đúng không có lỗi JavaScript", async ({ page }) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  for (const id of ["1", "2", "3", "999", "__proto__"]) {
    const response = await page.goto(`/Writer/statistics/${id}`);
    expect(response.status()).toBe(["1", "2", "3"].includes(id) ? 200 : 404);
  }
  expect(errors).toEqual([]);
});
