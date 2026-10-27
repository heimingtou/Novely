# Forum / Novely Community

## Căn cứ yêu cầu

- Task: [forum](https://app.notion.com/p/3f05f52fcbb980bb860ce1c9647408d8).
- Mô tả: [Forum/community](https://app.notion.com/p/3e75f52fcbb9804cbbbacd8ac0135870).
- Tham chiếu liên quan: [Spoiler System](https://app.notion.com/p/3e75f52fcbb980a79ffafc4df1f01839).

Mô tả yêu cầu feed lấy cảm hứng từ Threads, Trending/Latest, 8 chủ đề, người đăng → tên truyện, reaction, bình luận và lượt xem. Tệp PDF/Drive/Figma trong task chưa được connector trả đầy đủ; giao diện được thiết kế theo phong cách hiện có của Novely, không khẳng định đã đối chiếu thiết kế đính kèm.

## Chạy demo

```sh
npm install
npm run dev
```

Mở `http://localhost:3000/forum` hoặc bấm biểu tượng **Cộng đồng** trên Navbar. Trên PowerShell chặn script, dùng `npm.cmd`.

Các đường dẫn:

- `/forum`: feed Trending mặc định.
- `/forum?sort=latest`: bài mới nhất.
- `/forum?category=theory`: lọc chủ đề; có thể kết hợp `sort`, `q` và `saved=1`.
- `/forum/[postId]`: chi tiết bài, tương tác và bình luận.

## Chức năng

| Yêu cầu | Đã triển khai |
| --- | --- |
| Novely Community / Threads | Feed có avatar chữ, tên người đăng, truyện liên quan, nội dung và thanh tương tác |
| Trending / Latest | Trending theo điểm reaction, bình luận, lượt xem; Latest theo thời gian tạo. URL giữ bộ lọc và hỗ trợ Back/Forward |
| 8 chủ đề | Novel Discussion, Theory, Writer Corner, Find a Novel, Promote Your Novel, Creative Corner, General, Help |
| Người dùng → tên truyện | Gắn truyện có trong `src/data/novels.mjs`, bấm để về trang chi tiết |
| Reaction | Thích/bỏ thích, cập nhật số liệu và lưu lựa chọn |
| Bình luận | Thêm/xóa bình luận tự tạo, tách theo bài, giữ lại sau tải trang |
| Viewers / lượt xem | Số liệu mẫu cộng một lần mở chi tiết trên trình duyệt hiện tại; không cộng lặp khi reload hoặc tương tác |
| Luồng tạo bài | Lấy tên tài khoản đang đăng nhập; chọn chủ đề, truyện tùy chọn, nhập tiêu đề, nội dung và cờ spoiler; sửa/xóa bài tự tạo |
| Tìm kiếm và bài đã lưu | Tìm theo nội dung/tên/tác giả/truyện, hỗ trợ tiếng Việt không dấu; bookmark và danh sách đã lưu |
| Spoiler | Người đăng tự đánh dấu; che cả tiêu đề và nội dung bài hoặc nội dung bình luận cho đến khi chủ động mở |
| Responsive | Sidebar trên desktop; thanh chủ đề cuộn ngang trên điện thoại; hỗ trợ chế độ tối của hệ thống |

## Dữ liệu và giới hạn

- Đây là **bản frontend demo**. Forum dùng chung `useDemoSession` với Navbar và Trang đọc: đăng nhập để tạo bài hoặc bình luận, tự lấy tên tài khoản và không có ô nhập tên riêng. Phiên hiện tại vẫn là mô phỏng; cần backend để xác thực thật, phân quyền server và chia sẻ bài giữa nhiều người dùng.
- Các nhân vật, bài viết, bình luận và số liệu mẫu trong `src/data/forum.mjs` được tự soạn. Không hiển thị số người đang online hoặc tạo cảm giác có dữ liệu thời gian thực.
- Bài và tương tác mới lưu trong `localStorage` tại khóa `novely:v1:forum`, theo origin hiện tại. Thay đổi đồng bộ giữa các tab cùng origin. Khác cổng/hostname hoặc trình duyệt sẽ là kho dữ liệu khác.
- Khi không ghi được localStorage, dùng bộ nhớ phiên và hiện thông báo; dữ liệu mới mất khi tải lại. Dữ liệu sai cấu trúc được loại bỏ an toàn.
- Mỗi thiết bị tối đa 100 bài tự tạo, mỗi bài tối đa 100 bình luận tự tạo. Tiêu đề tối đa 150 ký tự, nội dung 5.000, bình luận 2.000 và tên 40.
- Chỉ cho sửa/xóa bài và bình luận tự tạo; thao tác xóa bài dọn cả bình luận, reaction, bookmark và lượt mở cục bộ của bài đó. Những điều kiện này phục vụ demo, không thay thế kiểm tra quyền ở backend.
- Bài tạo mới chỉ tồn tại trên thiết bị, nên route chi tiết kiểm tra dữ liệu sau hydration. ID không có sẽ hiện giao diện "Không tìm thấy bài viết"; chưa phải HTTP 404 có thẩm quyền từ server cho dữ liệu người dùng.
- Spoiler chỉ được đánh dấu thủ công. Chưa triển khai AI phát hiện spoiler, so sánh với tiến độ đọc hay moderation; mô tả Forum không cung cấp quy tắc/dịch vụ cho các phần này.
- Forum dùng font Be Vietnam Pro có sẵn trong dự án. Không thêm thư viện runtime mới.

## Cấu trúc

- `src/app/forum/`: layout, metadata, trang feed và chi tiết.
- `src/components/forum/`: shell, feed, card bài viết, composer, bình luận và dialog.
- `src/lib/forum-model.mjs`: xác thực dữ liệu, thao tác bài/bình luận, tìm kiếm, sắp xếp và thống kê.
- `src/lib/useLocalStorageState.js`: adapter lưu dữ liệu dùng chung; Trang đọc giữ nguyên API `useReaderStorage` và các khóa cũ.
- `src/data/forum.mjs`: chủ đề và dữ liệu mẫu.

## Kiểm thử

```sh
npm test
npm run build
npm run test:e2e
```

`npm test` chạy cả logic Trang đọc và Forum. Playwright kiểm tra toàn bộ hai tính năng trên bản production ở cổng 3100. Có thể chạy server riêng bằng `npm run start -- --port 3100 --hostname 127.0.0.1` trước khi chạy E2E để dùng lại server đó.

Kiểm thử bao gồm: bộ lọc/Back, tìm kiếm không dấu, reaction/bookmark, lượt xem một lần, tạo/sửa/xóa bài, dữ liệu giữ sau reload, spoiler, bình luận tách theo bài, dữ liệu hỏng/bị chặn, đồng bộ tab và bố cục điện thoại. Ảnh kiểm tra nằm trong `test-results/` (đã ignore).

Khi nối backend, cần thay adapter lưu bằng API có tài khoản và kiểm tra quyền server, bổ sung phân trang, giới hạn tần suất và định nghĩa rõ cách tính lượt xem/Trending trước khi coi là cộng đồng nhiều người dùng.
