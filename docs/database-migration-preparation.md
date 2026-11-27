# BE02.4 — Chuẩn bị migration Supabase và kiểm thử Local

Báo cáo này ghi nhận lượt triển khai Local ban đầu tại d99e41d. Xem
[Final Pre-deployment Review](backend-predeployment-review.md) để biết retry
Writer mới, 43 test chuyển tiếp và các gate còn thiếu trước triển khai Supabase.

**Kết luận: PASS cho migration và kiểm thử Local.** Chưa triển khai Supabase;
kiểm thử thực thi PostgreSQL 17, quyền cloud và PostgREST vẫn cần hoàn tất trước
phê duyệt triển khai. Ngày 25/11/2026, branch `feature/backend-foundation`.

## Phạm vi và môi trường đã kiểm chứng

Chỉ kết nối `127.0.0.1:5432/novely_restore_test`, PostgreSQL **18.3**. Cấu hình
đăng nhập lấy trong bộ nhớ từ `backend/.env`; helper BE02.4 đổi riêng database
đích rồi kiểm tra lại tên database/host/port qua SQL. Không thay đổi cấu hình
kết nối Express hiện có, không kết nối Supabase, `novely_test` hoặc
`novely_reconcile_test` trong task này.

Đã xác nhận backup nằm ngoài repository; sử dụng database đã được người dùng
phục hồi, không đọc/copy nội dung dump vào repository. Chỉ lấy số lượng,
metadata và checksum tổng hợp; không xuất thông tin người dùng, hash mật khẩu
hoặc nội dung truyện. Các checksum chỉ đối chiếu trong bộ nhớ.

Giữ nguyên dependencies: Prisma CLI/Client/adapter **7.10.1**, `pg` **8.23.1**,
JavaScript ES Modules và Express. Không cài package mới.

## File được tạo hoặc chỉnh sửa

| File | Thay đổi |
| --- | --- |
| `database/migrations/20261125_01_expand_legacy.sql` | Mới: preflight, expand/backfill, trigger đồng bộ, index, RLS, hậu kiểm |
| `database/migrations/README.md` | Mới: vận hành Local, rollback và kế hoạch triển khai có phê duyệt |
| `database/tests/be02_4-compatibility.sql` | Mới: kiểm thử SQL với dữ liệu giả, không gọi sequence |
| `backend/scripts/lib/restore-target.js` | Mới: khóa đích Local, kiểm tra catalog, số dòng và checksum |
| `backend/scripts/migrate-restore.js` | Mới: dry-run rollback/apply trong transaction, đối chiếu trước/sau |
| `backend/prisma.transition.config.mjs` | Mới: Prisma config riêng cho database chuyển tiếp |
| `backend/prisma/transition/schema.prisma` | Mới: 19 model, Library status nullable, output Client riêng |
| `backend/scripts/prisma-transition.js` | Mới: chỉ cho phép validate/generate; che thông tin kết nối |
| `backend/transition-tests/migration.test.js` | Mới: 39 tests bao gồm test cha, CRUD/constraint/Prisma/RLS/đồng thời |
| `backend/package.json` | Thêm 5 lệnh chuyển tiếp, giữ dependencies và lệnh cũ |
| `backend/README.md` | Bổ sung hướng dẫn BE02.4 và phân biệt hai database Local |
| `docs/database-migration-preparation.md` | Báo cáo này |

Client sinh tại `backend/src/generated/prisma-transition/`, báo cáo tổng hợp/log
tại `backend/.local/` được gitignore. Không đưa dữ liệu backup vào các thư mục đó.
`database/schema.sql`, Prisma schema chính, source Frontend, Next.js và
implementation BE01–BE02.3 không bị sửa.

## Schema trước và sau

| Thành phần public | Trước migration | Sau migration |
| --- | ---: | ---: |
| Bảng nghiệp vụ | 16 | 21 |
| Index, kể cả PK/UNIQUE | 38 | 70 |
| Trigger nghiệp vụ | 8 | 14 |
| Hàm trả về trigger | 5 | 7 |
| Hàm thường `recalc_counters()` | 1 | 1 |
| Sequence IDENTITY | 6 | 10 |
| Bảng Forum có RLS | 0 | 5 |
| Policy Forum | 0 | 0 |

Thêm `forum_category`, `forum_post`, `forum_comment`, `forum_reaction`,
`forum_report` theo thiết kế đã nghiệm thu. Cả năm dùng FK và CHECK của thiết kế
đích; hành vi xóa Forum là NO ACTION. Giữ toàn bộ 16 bảng cũ, bao gồm
`chapter_contents`, `chapter_likes` và `chapters.count_like`.

Các cột/ràng buộc bổ sung:

- `bookshelves.reading_status`: nullable, không có default; CHECK bốn giá trị
  `plan_to_read`, `reading`, `completed`, `dropped`. Giữ NULL cho **642** dòng cũ
  và thao tác thêm Library cũ chưa truyền trạng thái, theo xác nhận người dùng.
  Composite PK cũ tiếp tục ngăn lưu trùng truyện.
- `bookshelves.updated_at`: timestamptz NOT NULL, backfill từ `saved_at`,
  default `now()` và trigger cập nhật.
- `reading_progress.scroll_position`: integer NOT NULL DEFAULT 0, CHECK >= 0,
  đơn vị pixel. Giữ progress_percent [0,1] và FK ghép cũ, kể cả
  `ON DELETE SET NULL (chapter_id)` chỉ xóa tham chiếu chương.
- `reviews.updated_at`: timestamptz NOT NULL, backfill `created_at`, default
  `now()` và trigger. Giữ rating 1–5 và unique user/truyện.
- `chapters.content`: text NOT NULL DEFAULT '', copy nguyên văn từ nội dung cũ.
  Giữ UNIQUE novel/chapter_number và toàn bộ cột, ID, độ dài varchar cũ.
- `comments_id_chapter_key` và `fk_comments_parent_same_chapter`: parent phải
  cùng chương, CASCADE khi xóa cha. Giữ FK cha một cột và tên constraint cũ để
  không thay thế quan hệ mà code/PostgREST có thể tham chiếu.

Giữ nguyên **38 index cũ**; thêm 8 index từ PK/UNIQUE mới và 24 index truy vấn.
Ba đường index tương đương đã có được tái sử dụng. Tất cả 70 index valid/ready,
không phát hiện nhóm index có cùng biểu thức/cột/thứ tự hoàn toàn.

Thêm 4 timestamp trigger cho Library, Review, Forum post/comment, tái sử dụng
`set_updated_at()`. Mở rộng đúng trigger chương cũ để bắt cập nhật `content`,
không tạo thêm BEFORE UPDATE chồng lặp. Thêm 2 trigger và 2 hàm đồng bộ nội dung.
Các constraint, FK/delete action, grants/policies và 6 function cũ giữ nguyên;
ngoại lệ duy nhất trong định nghĩa trigger cũ là bổ sung content vào danh sách
cột của `trg_chapters_updated`.

## Bảo toàn dữ liệu

Các số dưới đây đã đối chiếu trước DDL, sau DDL và sau dọn toàn bộ fixture:

| Bảng cũ | Trước | Sau |
| --- | ---: | ---: |
| users | 202 | 202 |
| profiles | 202 | 202 |
| novels | 61 | 61 |
| chapters | 1.054 | 1.054 |
| chapter_contents | 1.054 | 1.054 |
| chapter_likes | 2.101 | 2.101 |
| comments | 1.749 | 1.749 |
| bookshelves | 642 | 642 |
| reading_progress | 1.530 | 1.530 |
| reviews | 526 | 526 |
| follows | 746 | 746 |
| novel_likes | 743 | 743 |
| genres | 24 | 24 |
| novel_genres | 122 | 122 |
| interact_novel | 60 | 60 |
| interact_novel_day | 1.410 | 1.410 |

Checksum tổng hợp của **mọi cột gốc** trong 16 bảng khớp trước/sau migration,
bao gồm ID, counter và timestamp. Sau fixture, checksum cả cột mới cũng khớp
trạng thái ngay trước test. Toàn bộ **1.054/1.054** nội dung khớp byte UTF-8,
không trim hoặc đổi xuống dòng. Không có dữ liệu thử còn lại, năm bảng Forum
trở về 0 dòng. Một truyện chưa có `interact_novel` vẫn giữ nguyên, không tự tạo
thống kê hoặc sửa dữ liệu.

DDL và SQL compatibility test bằng ID âm không đổi giá trị sequence cũ. Các
test Prisma tạo IDENTITY thật sau đó có làm sequence tăng, kể cả INSERT bị
constraint từ chối; đây là hành vi PostgreSQL không rollback `nextval`. Không
reset hoặc đổi định nghĩa/ownership sequence. Giá trị trước/sau từng lượt được
ghi trong báo cáo tổng hợp Local; không nhầm điều này với thay đổi ID dữ liệu cũ.

## Tương thích source Next.js và dependency

Đã đọc `database/schema.sql`, `docs/database-reconciliation.md`,
`backend/prisma/schema.prisma`, các service trong `src/server/services/`,
`src/server/presenters.js`, wrapper API trong `src/app/api/`, adapter Supabase và
`src/lib/seed_novel.py`. Các phụ thuộc đáng chú ý:

| File/nhóm | Phụ thuộc còn được giữ |
| --- | --- |
| `src/server/services/chapters.js` | Reader chọn `chapters.count_like`, join `chapter_contents(content)`, fallback rỗng |
| `src/server/services/writer.js` | Đọc nội dung cũ; metadata trước/plain INSERT nội dung; upsert khi sửa; xóa bảng con; thống kê chapter count_like |
| `src/server/services/catalog.js`, `novels.js`, `users.js`, `profiles.js` | Truyện, tác giả, profile, reviews, like/follow, thống kê hiện có |
| `src/server/presenters.js` | Chuyển các trường counter hiện có sang response |
| `src/app/api/novels/**`, `genres/route.js`, `users/[id]/route.js` | Giữ contract service/response đang có |
| `src/lib/seed_novel.py` | Vẫn sinh `chapter_contents`, `chapter_likes` và dùng counter trigger; chỉ đọc script, không chạy seed |

Đã thử SQL có hình dạng truy vấn reader/catalog/thống kê cũ, thao tác Writer hai
bước, upsert, xóa/đổi chapter_id của nội dung, xóa chương theo bảng con trước.
Hai bản content cập nhật nguyên tử, không lặp trigger, không tự tạo lại nội dung
đã xóa. Timestamp content-only cập nhật qua đúng một BEFORE trigger; counter
like/follow/comment tăng đúng một lần, soft-delete/restore bình luận đúng.
`refreshNovelCounters()` của Writer vẫn quản lý thống kê truyện như trước;
không bổ sung trigger tăng count_chapter hoặc nhân đôi logic service.

Đã kiểm tra `pg_depend`, liên kết trigger→function và thân hàm:

- `recalc_counters()` phụ thuộc nghiệp vụ vào `users`, `follows`, `novels`,
  `novel_likes`, `chapters`, `chapter_likes`, `comments`; giữ nguyên thân hàm và
  thử thực thi trong savepoint rồi rollback toàn bộ thay đổi.
- Bốn hàm counter cũ tiếp tục cập nhật users/novels/chapters từ bảng like,
  follow, comment; không thêm counter trigger chồng lặp.
- `set_updated_at()` được tái sử dụng cho các trigger timestamp.
- `pg_depend` của các hàm PL/pgSQL này chỉ ghi language/schema; tham chiếu bảng
  trong chuỗi thân hàm không được phản ánh đầy đủ ở đó. Vì vậy không kết luận
  `chapter_likes` không có dependency chỉ từ catalog. Danh sách tham chiếu thân
  hàm cũng đã được đọc và đối chiếu, không chỉ tìm tên chuỗi tự động.

Các service dùng admin client của Supabase. Kiểm thử SQL Local không thay thế
kiểm thử quyền admin thực tế, HTTP/PostgREST, nested relation và schema cache.
Đặc biệt FK tự tham chiếu comments mới có thể cần relation hint rõ ràng khi
phát triển truy vấn nested comments sau này; code hiện tại chưa dùng quan hệ đó.

## Prisma chuyển tiếp

Giữ nguyên schema/Client chính phục vụ baseline 19 bảng. Tạo bản schema riêng
với **19 model trên 21 bảng vật lý**; hai bảng legacy không được đưa trở lại mô
hình đích. Thay đổi logic duy nhất so với model gốc là `Bookshelf.readingStatus`
thành `String?`, bỏ default giả định trạng thái. Client được generate sang thư
mục riêng; test dùng PostgreSQL adapter hiện có và dependency injection để tái
sử dụng repository Library/transaction của BE02.3.

Schema chính khai báo readingStatus bắt buộc không phù hợp với Library NULL.
Trước khi nối Express nghiệp vụ tới database chuyển tiếp, phải chủ động dùng
Client chuyển tiếp và xác định cấu hình triển khai trong task được duyệt; chưa
đổi runtime singleton/Health API hay gate Local của Express ở BE02.4.

Prisma schema chuyển tiếp là mô hình truy cập dữ liệu, không phải bản mô tả DDL
đầy đủ: tên PK/index legacy có thể khác, varchar legacy còn giới hạn độ dài,
CHECK/trigger/RLS không được model biểu diễn đầy đủ, comments có thêm FK cũ và
FK ghép. Cảnh báo Prisma về SetNull trên FK ghép vẫn tồn tại; SQL thực tế chỉ
SET NULL chapter_id và test xóa chương xác nhận novel_id được giữ. Không sửa
database để loại cảnh báo và không dùng Client schema sinh db push/migration.

## Kết quả kiểm thử thực tế

| Kiểm tra | Kết quả |
| --- | --- |
| Dry-run toàn bộ DDL + SQL compatibility, rollback rồi đối chiếu catalog/data/sequence 16 bảng | PASS |
| Apply cùng migration trên đúng Local restore trong một transaction | PASS |
| Prisma schema chính: validate + generate | PASS |
| Prisma schema chuyển tiếp: validate + generate | PASS, Client 7.10.1 |
| Kiểm thử chuyển tiếp: 19 model đọc, auto ID cho 10 cột identity, CRUD, constraint, relation, RLS, timestamps/counters, đồng thời, hậu kiểm | **39/39 PASS** |
| Backend unit regression hiện có, không cần kết nối DB | **94/94 PASS** |
| Model tests hiện có từ root | **35/35 PASS** |
| `git diff --check` | PASS |
| Bộ 479 SQL và 126 integration cũ | Không chạy lại: nhắm baseline 19 bảng, không phù hợp restore 21 bảng có dữ liệu; giữ database baseline nguyên trạng |
| Thực thi PostgreSQL 17.12 | Chưa kiểm chứng: Local chỉ có 18.3 |
| Quyền Supabase/HTTP PostgREST thật | Chưa kiểm chứng: ngoài phạm vi cho phép kết nối |

Các ca lỗi xác nhận CHECK 23514, UNIQUE 23505, FK 23503, RLS 42501. Forum thử
unique category, key reaction, CHECK status/content/reason, parent cùng post,
NO ACTION khi xóa post có con và xóa hợp lệ theo thứ tự bảng con. Library thử
trạng thái NULL/hợp lệ/sai, không lưu trùng; progress thử scroll âm và xóa chương
chỉ NULL chapter_id. Role Local không bypass RLS bị chặn đọc/ghi Forum dù có
quyền bảng qua role dựng sẵn; không tạo role/grant hoặc policy mới để thử.

## Rủi ro và điều kiện còn phải giải quyết

1. **Hai luồng ghi nội dung có thể deadlock.** Test cố ý tạo thứ tự khóa ngược,
   quan sát một transaction bị hủy, retry trong test và xác nhận nội dung cuối
   khớp. Tính nguyên tử giữ dữ liệu không lệch; đây không phải bằng chứng mọi
   request đồng thời đều thành công. Next.js chưa được bổ sung retry. Chốt một
   luồng ghi chủ đạo hoặc xử lý retry/điều phối trước khi bật đồng thời hai writer.
2. **Quyền cloud chưa được chứng minh.** Restore bỏ owner/grants; so sánh quyền
   trước/sau Local chỉ chứng minh migration giữ nguyên quyền Local. Trigger mới
   là invoker, cần kiểm tra quyền ghi hai bảng nội dung với role production;
   Forum hiện đóng với role không bypass và chưa có policy nghiệp vụ.
3. **PostgreSQL 17 cần chạy staging.** SQL dùng tính năng đã có ở 17, gồm
   [CREATE OR REPLACE TRIGGER](https://www.postgresql.org/docs/17/sql-createtrigger.html)
   và [ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html), không
   dùng cú pháp chỉ có ở 18; việc đã chạy trên 18.3 không xác nhận toàn bộ extension,
   collation, quyền hay thời gian khóa trên 17.12.
4. **Cần cửa sổ bảo trì.** Khóa 16 bảng và tạo index thông thường trong một
   transaction. Không tự tăng timeout, bỏ preflight hoặc chạy trên cloud có tải.
5. **Chưa dọn chuyển tiếp.** Không xóa hai bảng cũ/counter, không ép NULL Library
   sang trạng thái suy đoán. Một thống kê còn thiếu giữ nguyên. My Clipping,
   bookmark/highlight đoạn, lưu bài Forum, spoiler và reaction chương đầy đủ vẫn
   cần thiết kế/task riêng; không bổ sung bảng hoặc gỡ giao diện ở đây.

## Chạy lại, rollback và Git

Hướng dẫn đầy đủ và ví dụ psql nhập mật khẩu tại Terminal nằm trong
[migration README](../database/migrations/README.md). Database hiện đã là 21 bảng,
chạy lại `test:transition`, không chạy lại `db:transition:apply` hoặc SQL đích 19
bảng. Không reset sequence để lấp khoảng trống ID do test.

Trước commit có rollback transaction đã thử thành công. Sau commit ưu tiên giữ
schema mở rộng và rollback ứng dụng; không cung cấp DOWN xóa cột/bảng. Phục hồi
backup chỉ sau khi dừng ghi, giữ thay đổi mới và thử ở môi trường cô lập được
duyệt. Chưa thử phục hồi toàn bộ dump trong BE02.4.

Git: đang ở `feature/backend-foundation`; hai file tracked sửa là
`backend/package.json` và `backend/README.md`, mười file mới như bảng trên. Có
file untracked `Microsoft/Windows/PowerShell/ModuleAnalysisCache` đã có trước
task, không thuộc thay đổi này. Không stage, commit hoặc push. Không sửa Frontend,
không migration Supabase hoặc database baseline và dừng sau BE02.4.
