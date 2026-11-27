# Migration chuyển tiếp BE02.4

`20261125_01_expand_legacy.sql` nâng schema cũ 16 bảng lên **21 bảng chuyển tiếp**.
Giữ `chapter_contents`, `chapter_likes`, `chapters.count_like` để Backend Next.js
tiếp tục hoạt động. `database/schema.sql` vẫn là thiết kế đích 19 bảng dành cho
database rỗng; không chạy file đó lên database có dữ liệu.

Xem [báo cáo và kết quả kiểm thử](../../docs/database-migration-preparation.md).
Final review: [kết quả và giới hạn](../../docs/backend-predeployment-review.md),
[runbook preflight/dry-run/hậu kiểm](../../docs/supabase-deployment-runbook.md).

Ngày 27/11/2026: migration Production đã COMMIT với phê duyệt riêng; hậu kiểm
SQL và PostgREST PASS. Xem [nghiệm thu Production](../../docs/be02-4-production-acceptance.md)
về bằng chứng và điều kiện mở lại Vercel. Không chạy lại migration trên schema
21 bảng đã nghiệm thu.

## Chạy lại trên Local

Các lệnh sau chạy từ root repository bằng Node.js 24 và dependencies Backend
đã cài. Không cần cài thêm package.

`backend/.env` giữ DATABASE_URL Local của BE02.2/3. Tool BE02.4 kiểm tra cấu hình
cũ, dùng thông tin đăng nhập trong bộ nhớ và **chỉ đổi tên database đích thành
`novely_restore_test`** trước khi mở kết nối. Tool xác minh thêm host, port và
`current_database()`; không mở kết nối đến baseline. Không sửa `.env` sang
Supabase hoặc nới điều kiện kết nối của ứng dụng Express.

Database Local hiện đã được apply migration. Chỉ cần:

```powershell
npm.cmd run db:transition:validate --prefix backend
npm.cmd run db:transition:generate --prefix backend
npm.cmd run test:transition --prefix backend
npm.cmd test --prefix backend
npm.cmd test
git diff --check
```

`test:transition` chỉ chạy trên `127.0.0.1:5432/novely_restore_test`. Test cần role
Local `postgres` để thử `SET LOCAL ROLE` với các role dựng sẵn. Không sửa quyền
PostgreSQL toàn cục. Dữ liệu giả được rollback; ca ghi đồng thời dùng ID âm,
commit rồi xóa bằng cả ID lẫn marker trong `finally`. Test cuối đối chiếu checksum
của dữ liệu gốc và metadata. Kiểm thử ID tự sinh gọi `nextval`, vì vậy sequence
có thể tăng sau mỗi lượt dù không còn dữ liệu thử; không reset sequence.

Các lệnh sau chỉ dành cho **bản phục hồi nguyên trạng 16 bảng**, chưa apply:

```powershell
npm.cmd run db:transition:check --prefix backend
npm.cmd run db:transition:apply --prefix backend
```

`check` chạy toàn bộ DDL và SQL kiểm thử trong transaction, rồi rollback và đối
chiếu lại catalog/dữ liệu/sequence. `apply` làm cùng hậu kiểm, sau đó commit. Cả
hai yêu cầu đúng 16 bảng và số dòng snapshot đã khảo sát; trên database 21 bảng
hiện tại, chúng dừng trước khi thay đổi. Không tự xóa, reset hoặc restore đè để
chạy lại hai lệnh này. Cần môi trường phục hồi riêng được nhóm cho phép nếu muốn
lặp lại toàn bộ vòng migration.

## Quy tắc dữ liệu và cơ chế tương thích

- Library cũ giữ `reading_status = NULL`, nghĩa là chưa rõ, theo xác nhận của
  người dùng. Cột không có default để cả luồng cũ chỉ ghi `(user_id, novel_id)`
  cũng giữ đúng ý nghĩa này. Repository Express hiện có vẫn chủ động truyền
  `plan_to_read` khi tạo mới. CHECK chấp nhận NULL và bốn trạng thái đã thống nhất.
- `bookshelves.updated_at` lấy từ `saved_at`; `reviews.updated_at` lấy từ
  `created_at`. Đây là mốc biết được, không khẳng định lịch sử sửa đổi trước đó.
- `scroll_position` mặc định 0, là số pixel nguyên không âm; không suy đoán vị
  trí cũ từ `progress_percent`.
- Nội dung được copy trực tiếp, không trim/chuẩn hóa xuống dòng. Backfill thực
  hiện trước khi mở rộng trigger timestamp chương nên giữ timestamp gốc.
- Ghi `chapter_contents` đồng bộ sang `chapters.content`; ghi content của
  `chapters` đồng bộ ngược. Trigger chạy trong cùng transaction và kiểm tra
  byte UTF-8 để tránh vòng lặp. Xóa/đổi chapter_id của nội dung cũ được xử lý.
- Luồng Writer cũ tạo metadata rồi INSERT nội dung vẫn hợp lệ: chương mới có
  content rỗng không tự tạo hàng `chapter_contents`. Đây là trạng thái tạm của
  luồng hai bước; reader cũ đã có fallback nội dung rỗng. Ghi nội dung không rỗng
  bằng Prisma tạo hàng tương thích để reader cũ đọc được.
- Giữ nguyên tất cả counter trigger và `recalc_counters()`. Không tăng counter
  lần nữa trong Express. Giữ các FK và hành vi xóa cũ; chỉ thêm FK phản hồi cùng
  chương bên cạnh FK cha cũ để không đổi tên quan hệ đang tồn tại.
- Năm bảng Forum bật RLS, không tạo policy hoặc grant công khai. Chưa mở API Forum.

Hai transaction ghi hai bản nội dung theo thứ tự khóa ngược nhau có thể deadlock.
Final review giữ Next.js Writer là luồng chính và bổ sung tối đa hai retry cho
từng câu ghi bị hủy với 40P01; không retry toàn bộ quy trình tạo chương. Helper
đã thử với deadlock PostgreSQL thật. Hết lượt vẫn trả lỗi; chưa bật luồng ghi
chương Express. Cần thử client/PostgREST/PG17 và quyền thật theo runbook trước
triển khai Supabase.

## Transaction và rollback

SQL yêu cầu một transaction bao trùm; `SET LOCAL`, `LOCK TABLE` và DDL phải ở
trong transaction đó. Node runner dừng ngay khi query lỗi, không chạy câu tiếp
theo và rollback trong `finally`. Khi dùng psql phải bật `ON_ERROR_STOP` và
`--single-transaction`. Không chạy file SQL từng đoạn bằng autocommit.

Migration khóa 16 bảng cũ theo thứ tự ổn định bằng `ACCESS EXCLUSIVE`, đặt
`lock_timeout=5s`, `statement_timeout=60s`. Nó copy dữ liệu và tạo index thông
thường trong cùng transaction. Cần cửa sổ bảo trì; không phù hợp để chạy ngay
trên hệ thống đang có nhiều truy cập. Không tự đổi timeout nếu chưa đo thời gian
trên staging và đánh giá dung lượng thực tế.

- Trước commit: lỗi hoặc hủy thao tác sẽ rollback toàn bộ DDL, dữ liệu backfill
  và trigger; dry-run Local đã kiểm chứng metadata, checksum và sequence khớp
  trạng thái đầu.
- Sau commit: ưu tiên rollback ứng dụng về Writer cũ và giữ schema mở rộng cùng
  trigger tương thích. Không có migration DOWN tự động vì xóa cột/bảng có thể làm
  mất trạng thái Library hoặc dữ liệu Forum mới phát sinh.
- Nếu bắt buộc quay lại snapshot trước migration: dừng ghi, ghi nhận mọi thay
  đổi phát sinh, phục hồi backup vào môi trường cô lập được duyệt, kiểm tra số
  dòng/checksum/quyền, rồi quyết định chuyển kết nối và cách hòa giải dữ liệu mới.
  Backup đang ở ngoài repository; BE02.4 không thực hiện phục hồi này.

## Triển khai Supabase sau khi nhóm phê duyệt

Các bước dưới là tham chiếu quy trình trước triển khai. Staging và Production
đã hoàn tất theo runbook và biên bản nghiệm thu ở trên; không chạy lại chúng
trên database đã nâng cấp.

1. Chốt quy tắc NULL của Library, luồng chủ đạo khi ghi chương, thời gian bảo
   trì, role chạy migration và kế hoạch phục hồi. Giữ hai bảng cũ đến task dọn
   chuyển tiếp riêng được duyệt.
2. Thử trên staging PostgreSQL 17 cùng extension/collation/role của Supabase.
   Restore Local đã bỏ qua owner/grants và một thuộc tính catalog, nên không dùng
   quyền Local thay bằng chứng quyền cloud. Đối chiếu lại schema, thân function,
   scoped timestamp trigger, FK/delete action, grant cột/bảng và default privilege.
3. Với role thực tế, thử writer/reader cũ qua PostgREST; thử trigger invoker có
   quyền ghi cả `chapters` và `chapter_contents`; thử anon/authenticated/service
   role đối với Forum. Xác nhận default privileges không mở quyền ngoài ý muốn.
   Chỉ thêm policy phục vụ nghiệp vụ khi có thiết kế authorization riêng.
4. Tạo backup mới ở ngoài repository, xác nhận phục hồi được. Dừng writer và
   chờ các thao tác tạo chương hai bước hoàn tất. Preflight sẽ chặn thiếu nội
   dung hoặc phản hồi sai chương; không tự sửa hay bỏ qua dữ liệu đó.
5. Đọc lại snapshot cloud mới: đủ 16 bảng, constraints/index/function phù hợp,
   số lượng theo thời điểm triển khai, không có nội dung lệch. Mốc số dòng trong
   runner Local chỉ dùng cho backup đã cung cấp, không áp đặt cho dữ liệu cloud
   mới phát sinh. Mọi khác biệt cấu trúc cần được xem xét trước khi chạy SQL.
6. Chỉ sau phê duyệt, dùng kết nối trực tiếp/session của role migration, không
   dùng transaction pooler để quản lý migration này. Nhập mật khẩu tại prompt
   Terminal, không đưa URL/mật khẩu vào lệnh hoặc Git. Ví dụ cú pháp, thay các
   placeholder bằng host/role đã duyệt:

   ```powershell
   & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X `
     --host '<HOST_DA_DUYET>' --port 5432 --username '<ROLE_DA_DUYET>' `
     --dbname postgres --password --single-transaction --set ON_ERROR_STOP=1 `
     --file .\database\migrations\20261125_01_expand_legacy.sql
   ```

7. Hậu kiểm số dòng/checksum toàn bộ 16 bảng, 21 bảng chuyển tiếp, RLS Forum,
   trigger/index/constraint/sequence, truy vấn Prisma chuyển tiếp và Next.js.
   `NOTIFY pgrst,'reload schema'` trong migration chỉ được gửi khi commit; kiểm
   tra PostgREST nạp schema mới. Chỉ mở lại writer sau hậu kiểm.

Không chạy `prisma db push`, `migrate reset`, seed hoặc `database/schema.sql` để
nâng cấp database đang có dữ liệu. Schema Prisma chuyển tiếp dùng cho Client,
không mô tả đầy đủ legacy tables, CHECK, trigger, FK trùng quan hệ hoặc tên index
thực tế để sinh migration.
