# Ngôn ngữ giao diện

Mở menu ảnh đại diện → **Ngôn ngữ** → **Tiếng Việt** hoặc **English**. Dùng được khi chưa đăng nhập; giao diện sáng/tối vẫn được giữ.

## Quy ước biên tập

- Tiếng Việt dùng cách viết câu: “Hồ sơ”, “Góc tác giả”, “Cài đặt”, “Nâng cấp VIP”, “Trích đoạn của tôi”, “Tạo bài viết”, “Bài viết đã lưu”. Giữ cách viết chính thức cho Novely, VIP và tên phông chữ.
- Dùng “tô sáng”, “đánh dấu”, “tiết lộ tình tiết” thay cho việc trộn thuật ngữ tiếng Anh trong giao diện tiếng Việt.
- Tiếng Anh dùng sentence case: “Reading settings”, “My clippings”, “Create post”. Nhãn truy cập và thông báo dùng cùng bộ từ với nội dung nhìn thấy.

## Cách hoạt động

- `src/lib/i18n/messages.mjs`: từ điển hai ngôn ngữ, nhãn chuẩn hóa và mẫu nội suy. Khi thêm tính năng, khai báo nhãn ở đây, dùng `t()` để hiển thị.
- `LocaleProvider`: trạng thái giao diện dùng chung, lưu tại `novely:v1:locale`, đồng bộ giữa các tab. Cookie `novely-locale` giúp Server Components, metadata và thuộc tính `html.lang` trả đúng ngôn ngữ khi tải lại.
- Client Components dùng `useI18n()`. Server Components dùng `await getServerI18n()`. Lựa chọn chỉ nhận `vi` hoặc `en`; mặc định tiếng Việt.
- Cookie chỉ lưu tùy chọn giao diện, không chứa tài khoản hay thông tin xác thực. Nếu localStorage bị chặn, ứng dụng dùng bộ nhớ phiên và cookie cho phần giao diện server.
- Đổi ngôn ngữ không dịch tên truyện, chương, nội dung truyện, bài viết, bình luận hay ghi chú cá nhân. URL, mã thể loại, mã bài viết và khóa dữ liệu lưu không thay đổi.
- Giọng đọc theo ngôn ngữ của truyện (truyện mẫu là tiếng Việt), độc lập với ngôn ngữ giao diện.
