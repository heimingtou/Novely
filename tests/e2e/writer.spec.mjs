import { test, expect } from "@playwright/test";

test("mở danh sách chương ở truyện khác sẽ đóng danh sách đang mở", async ({ page }) => {
  await page.goto("/Writer");

  const firstCard = page.locator(".ContaintCard").nth(0);
  const secondCard = page.locator(".ContaintCard").nth(1);

  await firstCard.getByRole("button", { name: "Tiếp tục viết", exact: true }).click();
  await expect(firstCard.locator(".writer-card-menu")).toBeVisible();

  await secondCard.getByRole("button", { name: "Tiếp tục viết", exact: true }).click();
  await expect(firstCard.locator(".writer-card-menu")).toHaveCount(0);
  await expect(secondCard.locator(".writer-card-menu")).toBeVisible();
});
