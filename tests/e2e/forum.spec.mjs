import { test, expect } from "@playwright/test";

const path = "/forum/thu-vien-nhung-dieu-giu-lai";
const key = "novely:v1:forum";
async function openForum(page, url = "/forum") {
  await page.goto(url);
  await expect(page.locator(".forum-page-heading").getByRole("button", { name: "Tạo bài viết", exact: true })).toBeEnabled();
}
async function createPost(page, { title = "Cuộc trò chuyện thử nghiệm", body = "Một đoạn nội dung tiếng Việt cho bài thử nghiệm.", spoiler = false } = {}) {
  await page.locator(".forum-page-heading").getByRole("button", { name: "Tạo bài viết", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo bài viết" });
  if (await dialog.getByRole("button", { name: "Đăng nhập để đăng bài", exact: true }).isVisible()) await dialog.getByRole("button", { name: "Đăng nhập để đăng bài", exact: true }).click();
  await expect(dialog.getByLabel("Tên hiển thị", { exact: true })).toHaveCount(0);
  await expect(dialog.locator('input[name="name"]')).toHaveCount(0);
  await expect(dialog.locator(".forum-account")).toContainText("Bạn đọc Novely");
  await dialog.getByLabel("Chủ đề", { exact: true }).selectOption("writer-corner");
  await dialog.getByLabel(/Truyện liên quan/).selectOption("demo");
  await dialog.getByLabel("Tiêu đề", { exact: true }).fill(title);
  await dialog.getByLabel("Nội dung", { exact: true }).fill(body);
  if (spoiler) await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Đăng bài", exact: true }).click();
  await expect(page).toHaveURL(/\/forum\/post-[a-z0-9-]+$/);
  return page.url();
}

test("navbar vào Forum, có 8 chủ đề và feed kiểu thảo luận", async ({ page }) => {
  await page.goto("/novels/demo");
  await page.getByRole("link", { name: "Cộng đồng", exact: true }).click();
  await expect(page).toHaveURL(/\/forum$/);
  const nav = page.getByRole("navigation", { name: "Chủ đề cộng đồng" });
  await expect(nav.getByRole("link")).toHaveCount(10);
  await expect(page.locator(".forum-feed-list > .forum-post")).toHaveCount(10);
  await expect(page.getByRole("link", { name: "Thịnh hành", exact: true })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "test-results/forum-desktop.png" });
});

test("Trending/Latest và lọc chủ đề giữ tham số URL, nút Back hoạt động", async ({ page }) => {
  await openForum(page);
  await expect(page.locator(".forum-feed-list > .forum-post").first()).toHaveAttribute("aria-label", "Một góc nhỏ để kể về cuốn sách bạn đang đọc");
  await page.getByRole("link", { name: "Mới nhất", exact: true }).click();
  await expect(page).toHaveURL(/sort=latest/);
  await expect(page.locator(".forum-feed-list > .forum-post").first()).toHaveAttribute("aria-label", "Làm sao để lưu lại một đoạn văn mình thích?");
  await page.getByRole("navigation", { name: "Chủ đề cộng đồng" }).getByRole("link", { name: /^Giả thuyết/ }).click();
  await expect(page).toHaveURL(/category=theory/);
  await expect(page.locator(".forum-feed-list > .forum-post")).toHaveCount(2);
  await page.getByRole("link", { name: "Thịnh hành", exact: true }).click();
  await expect(page.getByRole("link", { name: "Thịnh hành", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/category=theory/);
  await page.goBack();
  await expect(page.getByRole("link", { name: "Mới nhất", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".forum-feed-list > .forum-post")).toHaveCount(2);
});

test("tìm không dấu, trạng thái trống và xóa tìm kiếm", async ({ page }) => {
  await openForum(page);
  await page.getByRole("textbox", { name: "Tìm bài viết", exact: true }).fill("thu vien anh trang");
  await page.getByRole("button", { name: "Tìm kiếm bài viết" }).click();
  await expect(page).toHaveURL(/q=thu\+vien\+anh\+trang/);
  await expect(page.locator(".forum-feed-list > .forum-post").first()).toBeVisible();
  await page.getByRole("textbox", { name: "Tìm bài viết", exact: true }).fill("khong-co-bai-viet-nay-xyz");
  await page.getByRole("button", { name: "Tìm kiếm bài viết" }).click();
  await expect(page.getByRole("heading", { name: "Chưa tìm thấy cuộc trò chuyện" })).toBeVisible();
  await page.getByRole("link", { name: "Xóa tìm kiếm" }).click();
  await expect(page.locator(".forum-feed-list > .forum-post")).toHaveCount(10);
});

test("thích và lưu bài bền vững, lượt xem chỉ cộng một lần", async ({ page }) => {
  await openForum(page, path);
  const post = page.locator(".forum-post-detail");
  const like = post.getByRole("button", { name: "Thích bài viết" });
  await expect(post.locator(".forum-view-count")).toHaveAttribute("aria-label", "369 lượt xem");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveText("43");
  await post.getByRole("button", { name: "Lưu bài viết", exact: true }).click();
  await page.reload();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(post.locator(".forum-view-count")).toHaveAttribute("aria-label", "369 lượt xem");
  await page.getByRole("navigation", { name: "Chủ đề cộng đồng" }).getByRole("link", { name: /^Bài viết đã lưu/ }).click();
  await expect(page.locator(".forum-feed-list > .forum-post")).toHaveCount(1);
  await page.getByRole("button", { name: "Bỏ lưu bài viết", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chưa có bài viết đã lưu" })).toBeVisible();
});

test("đăng, tải lại, sửa và xóa bài của mình", async ({ page }) => {
  await openForum(page);
  const url = await createPost(page, { title: "Một bài viết của tôi", body: "Nội dung có <script>alert('xss')</script> nhưng không thực thi." });
  await expect(page.getByRole("heading", { name: "Một bài viết của tôi", exact: true })).toBeVisible();
  await expect(page.locator(".forum-post-body")).toContainText("<script>");
  await expect(page.locator(".forum-post-detail .forum-post-author > strong")).toHaveText("Bạn đọc Novely");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Một bài viết của tôi", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Chỉnh sửa bài viết" });
  await expect(editor.getByLabel("Tên hiển thị", { exact: true })).toHaveCount(0);
  await editor.getByLabel("Tiêu đề", { exact: true }).fill("Bài viết đã chỉnh sửa");
  await editor.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("heading", { name: "Bài viết đã chỉnh sửa", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bài viết", exact: true }).click();
  await expect(page).toHaveURL(/\/forum\?sort=latest$/);
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Không tìm thấy bài viết" })).toBeVisible();
});

test("bài viết toàn khoảng trắng không được lưu", async ({ page }) => {
  await openForum(page);
  await page.locator(".forum-page-heading").getByRole("button", { name: "Tạo bài viết", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Đăng nhập để đăng bài", exact: true }).click();
  await dialog.getByLabel("Tiêu đề", { exact: true }).fill("   ");
  await dialog.getByLabel("Nội dung", { exact: true }).fill("   ");
  await dialog.getByRole("button", { name: "Đăng bài", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Nhập tiêu đề bài viết");
  await expect(dialog).toBeVisible();
});

test("spoiler che cả tiêu đề lẫn nội dung cho đến khi chủ động mở", async ({ page }) => {
  await openForum(page);
  await createPost(page, { title: "Chi tiết bí mật cuối chương", body: "Nội dung tiết lộ cần được che đi.", spoiler: true });
  await expect(page.getByRole("heading", { name: "Chi tiết bí mật cuối chương" })).toHaveCount(0);
  const post = page.locator(".forum-post-detail");
  await post.getByRole("button", { name: /Bài viết tiết lộ tình tiết/ }).click();
  await expect(page.getByRole("heading", { name: "Chi tiết bí mật cuối chương" })).toBeVisible();
  await post.getByRole("button", { name: /Ẩn nội dung tiết lộ tình tiết/ }).click();
  await expect(page.getByRole("heading", { name: "Chi tiết bí mật cuối chương" })).toHaveCount(0);
});

test("bình luận lưu theo bài, spoiler riêng và xóa được bình luận của mình", async ({ page }) => {
  await openForum(page, path);
  const section = page.getByRole("region", { name: "Bình luận", exact: true });
  await expect(section.locator(".forum-comment")).toHaveCount(2);
  await expect(section.getByRole("button", { name: "Gửi bình luận", exact: true })).toHaveCount(0);
  await section.getByRole("button", { name: "Đăng nhập để bình luận", exact: true }).click();
  await expect(section.getByLabel("Tên hiển thị", { exact: true })).toHaveCount(0);
  await expect(section.locator(".forum-account")).toContainText("Bạn đọc Novely");
  await section.getByLabel("Bình luận của bạn", { exact: true }).fill("Một nhận xét cần che spoiler");
  await section.getByRole("checkbox", { name: "Bình luận tiết lộ tình tiết" }).check();
  await section.getByRole("button", { name: "Gửi bình luận", exact: true }).click();
  await expect(section.locator(".forum-comment")).toHaveCount(3);
  await page.reload();
  const comment = section.locator(".forum-comment").last();
  await expect(comment.locator(".forum-comment-author > strong")).toHaveText("Bạn đọc Novely");
  await expect(comment.getByText("Một nhận xét cần che spoiler", { exact: true })).toHaveCount(0);
  await comment.getByRole("button", { name: /Bình luận tiết lộ tình tiết/ }).click();
  await expect(comment.getByText("Một nhận xét cần che spoiler", { exact: true })).toBeVisible();
  await comment.getByRole("button", { name: "Xóa bình luận của tôi", exact: true }).click();
  await expect(section.locator(".forum-comment")).toHaveCount(2);
  await openForum(page, "/forum/tim-truyen-hieu-sach");
  await expect(page.locator(".forum-comment")).toHaveCount(0);
});

test("đăng xuất đồng bộ chặn gửi bài và bình luận đang mở", async ({ page, context }) => {
  await openForum(page, path);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).first().click();
  const other = await context.newPage();
  await openForum(other, path);
  await page.locator(".forum-page-heading").getByRole("button", { name: "Tạo bài viết", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo bài viết" });
  await dialog.getByLabel("Tiêu đề", { exact: true }).fill("Bản nháp khi đăng xuất");
  await other.getByRole("button", { name: "Menu tài khoản", exact: true }).click();
  await other.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Đăng bài", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Đăng nhập để đăng bài", exact: true })).toBeVisible();
  await expect(other.locator(".forum-comment-form")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Đăng nhập để đăng bài", exact: true }).click();
  await expect(dialog.getByLabel("Tiêu đề", { exact: true })).toHaveValue("Bản nháp khi đăng xuất");
  await expect(other.locator(".forum-comment-form")).toBeVisible();
});

test("dữ liệu lưu bị hỏng vẫn hiện bài mẫu và tương tác được", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "{invalid"), key);
  await openForum(page);
  await expect(page.locator(".forum-feed-list > .forum-post")).toHaveCount(10);
  await page.getByRole("button", { name: "Thích bài viết" }).first().click();
  await expect(page.getByRole("button", { name: "Thích bài viết" }).first()).toHaveAttribute("aria-pressed", "true");
});

test("chặn localStorage không làm mất giao diện, có thông báo dữ liệu phiên", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); }; Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); }; });
  await openForum(page);
  await page.getByRole("button", { name: "Thích bài viết" }).first().click();
  await expect(page.locator(".forum-storage-warning")).toContainText("chỉ được giữ trong phiên này");
  await expect(page.getByRole("button", { name: "Thích bài viết" }).first()).toHaveAttribute("aria-pressed", "true");
});

test("hai tab đồng bộ reaction", async ({ page, context }) => {
  await openForum(page, path);
  const second = await context.newPage();
  await openForum(second, path);
  await page.getByRole("button", { name: "Thích bài viết", exact: true }).click();
  await expect(second.getByRole("button", { name: "Thích bài viết", exact: true })).toHaveAttribute("aria-pressed", "true");
  await second.close();
});

test("forum trên điện thoại không tràn ngang và soạn bài được", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openForum(page);
  for (const width of [390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/forum-mobile.png" });
  await createPost(page, { title: "Bài viết từ điện thoại" });
  await expect(page.getByRole("heading", { name: "Bài viết từ điện thoại", exact: true })).toBeVisible();
});

test("giao diện tối và trang bài không tồn tại không gây lỗi JavaScript", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await openForum(page);
  await page.screenshot({ path: "test-results/forum-dark.png" });
  await openForum(page, "/forum/khong-ton-tai");
  await expect(page.getByRole("heading", { name: "Không tìm thấy bài viết" })).toBeVisible();
  expect(errors).toEqual([]);
});
