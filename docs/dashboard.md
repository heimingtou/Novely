# Dashboard tác giả

Chạy `/Writer` để xem danh sách, `/Writer/statistics/1` để xem thống kê. Tác phẩm mẫu 1, 2, 3 dùng cùng dữ liệu cho danh sách, dashboard và trang thông tin chia sẻ `/novels/1`, `/novels/2`, `/novels/3`.

- Nút chia sẻ dùng Web Share nếu có, dự phòng sao chép liên kết hoặc hiển thị URL. Trang chia sẻ chỉ chứa thông tin tác phẩm mẫu; không tạo nội dung chương giả.
- **Đăng truyện mới** mở trình soạn bản nháp, yêu cầu phiên đăng nhập demo. **Tiếp tục viết** mở lại bản nháp của đúng truyện. Lưu tại `novely:v1:writer-drafts`, không xuất bản hay gửi tới server. Giới hạn 100 bản nháp, tiêu đề 150 ký tự, bản thảo 50.000 ký tự. Khi storage lỗi, chỉ giữ trong phiên và báo trên trang.
- Tab **Tất cả truyện** gồm cả truyện mẫu và bản nháp mới; **Đã đăng tải** gồm truyện mẫu; **Series** lọc truyện dài kỳ. Bản nháp mới không có liên kết chia sẻ hoặc số liệu thống kê giả.
- Nền sáng/tối theo giao diện chung; nhãn dashboard hỗ trợ tiếng Việt/Anh. ArrowLeft/ArrowRight, Home/End chuyển tab và đưa focus tới tab được chọn.
- Không có backend xuất bản hay xác thực thật. Cần thay session demo bằng tài khoản thật và kiểm tra quyền trên API trước khi triển khai sản phẩm.
