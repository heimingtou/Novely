# Trang đọc Novely

Nguồn yêu cầu: [Trang đọc](https://app.notion.com/p/3e75f52fcbb9807a9243f739fceb33bb), [Comment theo chương](https://app.notion.com/p/3e75f52fcbb980dd8091ec26dd166585).

## Chạy thử

```sh
npm install
npm run dev
```

Trên Windows PowerShell có chặn script, dùng `npm.cmd` thay cho `npm`.
Mở `http://localhost:3000/novels/demo`, bấm một chương hoặc nút **Đọc từ đầu**.
URL đọc: `/novels/demo/chapters/1` (các chương hiện có: 1, 2, 3).

## Đã triển khai

| Yêu cầu | Cách sử dụng |
| --- | --- |
| Chương trước/sau, danh sách chương | Đầu và cuối chương, vô hiệu hóa tại hai đầu danh sách |
| Bookmark vị trí | Nút bên lề từng đoạn hoặc nút trên thanh công cụ; xem lại/xóa trong sổ tay |
| Tự lưu và đọc tiếp | Lưu chương, mã đoạn và vị trí tương đối trong đoạn; khôi phục sau tải lại, có nút Đọc tiếp ở chi tiết |
| Đổi font, cỡ chữ, độ rộng, giãn dòng | Bảng Cài đặt đọc, giữ đoạn đang đọc khi thay đổi bố cục |
| Dark mode, Sepia, độ sáng | Ba nền Sáng/Giấy ấm/Tối; độ sáng chỉ tác động vùng nội dung |
| Ẩn/hiện phần trăm đọc | Cài đặt đọc; phần trăm ước lượng theo đoạn và vị trí trong đoạn của chương hiện tại |
| Reaction và bình luận theo chương | Cuối chương, chọn/bỏ cảm xúc; thêm và xóa bình luận trên thiết bị |
| Text-to-Speech | Nghe từ đoạn hiện tại, tốc độ, tạm dừng/tiếp tục/dừng; hủy khi chuyển trang |
| Highlight và ghi chú | Chọn chữ trong một đoạn; tô sáng hoặc nhập ghi chú; sửa/xóa trong sổ tay |

### My Clipping và công cụ đọc

- Chọn văn bản để mở bảng Highlight. Bấm **Highlight** hoặc lưu ghi chú sẽ tự động thêm trích đoạn vào **My Clipping**, không cần bấm lưu lần nữa.
- Nút **My Clipping** trên thanh công cụ mở bộ sưu tập của cả truyện, chia theo chương. Có thể mở lại đúng đoạn, sửa ghi chú hoặc xóa clipping (đồng thời bỏ highlight). Dữ liệu highlight cũ được dùng trực tiếp, không tạo bản sao.
- Cài đặt có ô nhập số bên cạnh thanh trượt cho cỡ chữ, giãn dòng, độ rộng và độ sáng. Enter hoặc rời ô sẽ áp dụng/giới hạn giá trị theo phạm vi và bước của thanh trượt; bỏ trống sẽ giữ giá trị hợp lệ gần nhất.
- Font gồm Noto Serif, Palatino, Bookerly, Be Vietnam Pro, Montserrat, Arial và Times New Roman. Be Vietnam Pro và Montserrat được đóng gói cùng dự án. Bookerly dùng bản đã có trên thiết bị, nếu thiếu sẽ dùng Noto Serif.
- Vòng tròn nổi ở góc dưới hiển thị phần trăm của chương đang đọc; viền vòng tròn tăng theo tiến độ. Cài đặt **Hiện phần trăm đã đọc** bật/tắt vòng tròn này. Tiến độ tự lưu và khôi phục sau khi tải lại.

Inline comment (bình luận công khai theo đoạn) đang để ngỏ trong Notion, chưa triển khai. Ghi chú theo đoạn hiện tại là dữ liệu cá nhân.

## Dữ liệu và giới hạn

- Chưa có backend, đăng nhập thật hoặc API: mọi dữ liệu cá nhân, bình luận và reaction của Trang đọc được lưu trên **trình duyệt hiện tại**, chưa đồng bộ tài khoản hay chia sẻ giữa người dùng. Giao diện bình luận có ghi rõ phạm vi này.
- Các khóa có tiền tố `novely:v1:`. Thiết lập dùng chung; tiến độ, bookmark, annotation và bình luận tách theo truyện/chương. Tiến độ gần nhất theo truyện dùng cho nút Đọc tiếp. Thay đổi đồng bộ giữa các tab cùng origin.
- localStorage bị chặn/hết dung lượng: tiếp tục hoạt động bằng bộ nhớ phiên và hiện thông báo. Dữ liệu này mất khi tải lại. JSON sai hoặc tham chiếu đoạn đã bị xóa được bỏ qua.
- Ba chương do dự án tự soạn ở `src/data/novels.mjs`. Giữ nguyên mã đoạn khi sửa nội dung; annotation có trích dẫn không còn khớp sẽ bị bỏ qua để tránh tô nhầm câu.
- Bookmark lưu cả đoạn. Highlight/ghi chú lưu phạm vi ký tự trong một đoạn; không nhận vùng chồng lấn hoặc lựa chọn kéo qua nhiều đoạn. Có thể có nhiều highlight tách biệt trong một đoạn.
- Giới hạn mỗi chương: 100 bình luận, 200 highlight; ghi chú 1.000 ký tự, bình luận 1.500 ký tự. Đây là giới hạn bản demo.
- Giọng Việt phụ thuộc giọng có sẵn trên thiết bị/trình duyệt. Nếu thiếu API nghe, vẫn đọc chữ bình thường. Nếu thiếu giọng Việt, giao diện báo sử dụng giọng mặc định. Kiểm thử tự động giả lập API; cần nghe thử trên thiết bị thật để đánh giá chất lượng giọng.
- Font có chân dùng Noto Serif được đóng gói trong dự án (giấy phép OFL), thay cho Georgia hệ thống vốn có thể thiếu ký tự tiếng Việt. Thiết lập `serif` đã lưu vẫn được giữ và tự dùng font mới; không cần xóa localStorage.
- Nút **Đọc từ đầu** quay về đoạn đầu chương 1; **Đọc tiếp** khôi phục vị trí gần nhất. Phần Navbar và footer chung giữ từ layout hiện tại.

## Cấu trúc mã

- `src/app/novels/[id]/chapters/[chapterNumber]/page.js`: lấy truyện/chương, metadata, xử lý không tìm thấy.
- `src/components/reader/ReadingPage.jsx`: ghép giao diện, khôi phục/tự lưu vị trí, chọn văn bản.
- `ReaderSettings`, `ReaderSpeech`, `ReaderNotebook`, `ReaderDiscussion`, `ChapterNavigation`: các chức năng riêng.
- `useReaderStorage.js`: localStorage, đồng bộ tab, dự phòng khi không lưu được.
- `src/lib/reader-model.mjs`: xác thực dữ liệu lưu và xử lý phạm vi highlight.

## Kiểm tra

```sh
npm test
npm run build
npm run test:e2e
```

Playwright chạy trên bản production tại cổng 3100. Windows mặc định dùng Chrome đã cài; máy khác dùng Chromium của Playwright (`npx playwright install chromium`). Có thể đặt `PLAYWRIGHT_CHANNEL=msedge` để dùng Edge.

Cũng có thể chạy `npm run start -- --port 3100 --hostname 127.0.0.1` ở một terminal riêng sau khi build; `npm run test:e2e` sẽ dùng lại server đó khi không ở CI. Cách này hữu ích trong môi trường Windows giới hạn quyền quản lý tiến trình.

Các test bao gồm URL sai/404, điều hướng, cài đặt, khôi phục vị trí, đổi cỡ chữ, bookmark giữa nhiều tab, highlight/ghi chú, bình luận, dữ liệu lưu hỏng/bị chặn, nghe và màn hình điện thoại. Ảnh và trace kiểm thử nằm trong `test-results/` và không được đưa vào Git.

Trước khi nối backend, cần thay các thao tác lưu tương tác bằng API có tài khoản, kiểm tra quyền xóa bình luận và đồng bộ tiến độ theo người dùng.
