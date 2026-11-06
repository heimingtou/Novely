import { test, expect } from "@playwright/test";

async function openToggle(page) {
  await page.getByRole("button", { name: "Menu tài khoản", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "Chế độ tối", exact: true });
  await expect(toggle).toBeEnabled();
  return toggle;
}

test("bật tối toàn website, lưu khi chuyển trang và tải lại, giữ thông số đọc", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/novels/demo/chapters/1");
  await page.getByRole("button", { name: "Cài đặt đọc", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Nhập cỡ chữ", exact: true }).fill("25");
  await page.getByRole("spinbutton", { name: "Nhập cỡ chữ", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Đóng cài đặt", exact: true }).click();
  const toggle = await openToggle(page);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".novely-reader")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".reader-prose")).toHaveCSS("font-size", "25px");
  await expect(page.locator("#account-menu")).toHaveCSS("background-color", "rgb(30, 41, 59)");
  for (const route of ["/", "/Home", "/search", "/novel/1", "/novels/demo", "/forum", "/novels/demo/chapters/2"]) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(15, 23, 42)");
    await expect(page.getByAltText("logo").nth(0)).toBeHidden();
    await expect(page.getByAltText("logo").nth(1)).toBeVisible();
  }
  await page.reload();
  await expect(page.locator(".novely-reader")).toHaveAttribute("data-theme", "dark");
});

test("tắt tối được ngay cả khi hệ điều hành tối và đồng bộ giữa hai tab", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/forum");
  const toggle = await openToggle(page);
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".novely-forum")).toHaveCSS("--f-muted", "#687383");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const other = await context.newPage();
  await other.goto("/novels/demo/chapters/1");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
  await (await openToggle(page)).click();
  await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(other.locator(".novely-reader")).toHaveAttribute("data-theme", "dark");
});

test("đổi giao diện bằng bàn phím trên điện thoại, không cần đăng nhập", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/novels/demo");
  const toggle = await openToggle(page);
  await toggle.focus();
  await toggle.press("Space");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  const box = await page.locator("#account-menu").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/site-dark-menu-mobile.png" });
});

test("storage bị chặn vẫn chuyển màu được trong phiên", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/forum");
  const toggle = await openToggle(page);
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("lựa chọn đã lưu áp dụng trước khi JavaScript ứng dụng chạy", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("novely:v1:theme", JSON.stringify("light")));
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto("/novels/demo");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(247, 248, 250)");
});
