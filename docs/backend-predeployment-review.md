# BE02.4 — Final Pre-deployment Review

**Kết luận: NOT READY để COMMIT migration trên Supabase thật.** Các thay đổi
code tối thiểu và kiểm thử Local đã đạt; còn thiếu bằng chứng PG17.12, quyền và
PostgREST trên môi trường Supabase/staging thực tế. Không kết nối Supabase trong
task review này. Branch `feature/backend-foundation`, HEAD bắt đầu `d99e41d`,
ngày 25/11/2026.

## Kết quả review và thay đổi Writer

Đã đọc migration và `src/server/services/writer.js`, các service Reader/catalog/
profile/novel liên quan, adapter admin và source/API tìm kiếm quan hệ comments.
Giữ nguyên migration đã nghiệm thu từ `d99e41d`, schema đích 19 bảng và Prisma
schema; không đổi trigger, FK hoặc database hiện có để tránh lỗi phía client.

Next.js Writer tiếp tục ghi metadata chương rồi ghi `chapter_contents`, trigger
đồng bộ `chapters.content` như đã thiết kế. Chưa có API ghi chương Express.

Thêm duy nhất helper `retryDeadlockedQuery(createQuery)`:

- Chỉ retry mã SQLSTATE **40P01**, tối đa **3 lần thử = 1 lần đầu + 2 retry**.
  Backoff 25–49 ms rồi 50–74 ms, có jitter, không cài dependency.
- Mỗi lần gọi factory để tạo query mới. Áp dụng cho từng POST/PATCH/DELETE của
  metadata/nội dung chương, các bước xóa bảng con và DELETE bù khi tạo thất bại.
- Một request PostgREST là ranh giới transaction. Chỉ lặp câu ghi đã được DB xác
  nhận hủy; không lặp ownNovel/ownChapter, đọc số chương, quy trình tạo chương,
  upload hoặc cập nhật tổng hợp truyện đã hoàn tất.
- Với INSERT IDENTITY, 40P01 nghĩa là transaction chưa lưu hàng; retry cùng dữ
  liệu/số chương có thể tạo khoảng trống sequence nhưng không tạo hai hàng đã
  commit. Nếu đụng UNIQUE vì tác giả tạo cùng số chương, trả lỗi, không tự đổi số.
- Không retry lỗi mạng/timeout hoặc lỗi UNIQUE/FK/CHECK/RLS, 40001, 55P03,
  PGRST201 hay HTTP 500 nói chung. Hết lượt giữ nguyên kết quả lỗi cho cơ chế
  xử lý hiện tại; helper không log query, dữ liệu hoặc thông tin kết nối.

PostgreSQL có thể hủy một transaction trong deadlock; retry phải bắt đầu một
transaction mới. Không dùng helper để lặp SQL trong transaction đang aborted.
Test Local chủ động rollback trước mỗi lần thử lại.
([PostgreSQL 17: deadlocks](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-DEADLOCKS))

Không chuyển Writer thành quy trình nguyên tử nhiều bước: crash hoặc lỗi mạng
vẫn có thể để metadata đã lưu nhưng content/counter chưa hoàn tất, như giới hạn
cũ. Không thêm retry tổng quát che trạng thái không rõ đã commit hay chưa. Khâu
DELETE bù vẫn có thể thất bại; cần kiểm tra chương thiếu nội dung khi bảo trì.
Chưa bổ sung kiểm soát phiên bản hoặc giải quyết hai lượt chỉnh sửa cùng chương;
retry deadlock không bảo đảm chống ghi đè giữa các request nhiều bước.

## PostgREST và FK comments

FK cũ `fk_comments_parent(parent_id)` vẫn còn; FK mới
`fk_comments_parent_same_chapter(parent_id,chapter_id)` bổ sung kiểm tra cùng
chương. Audit Local xác nhận cả hai FK valid.

Source hiện không có truy vấn nested parent/replies của comments. Writer chỉ
lọc/xóa/đếm comments phẳng, do đó không cần sửa query hiện có. Các embedding
chapter_contents, genres, interact_novel, profiles, reviews→novels và
`users!fk_follows_follow` giữ nguyên FK đang dùng.

Nhiều FK có thể gây PGRST201; self-reference còn có nhập nhằng chiều quan hệ.
Tài liệu PostgREST hướng dẫn computed relationships cho quan hệ đệ quy; không
coi thêm !constraint là bảo đảm self-embed hoạt động. Chưa thêm function/API mới.
([PostgREST resource embedding](https://docs.postgrest.org/en/stable/references/api/resource_embedding.html#recursive-relationships))

Ở task comments sau này, ưu tiên hai truy vấn phẳng và ghép theo parent_id,
cùng filter chapter_id; hoặc thiết kế quan hệ rõ ràng sau khi thử đúng phiên bản
PostgREST. Không bỏ FK cũ hoặc sửa schema chỉ để né nhập nhằng. Smoke HTTP sau
reload cache vẫn là gate chưa được xác nhận trong review này.

## Quyền ứng dụng, RLS và default privileges

Admin adapter hiện dùng secret key ở server, không mang phiên Supabase người
dùng. Supabase ánh xạ secret key sang service_role có BYPASSRLS; vẫn phải kiểm
tra grants thực tế và giữ kiểm tra quyền tác giả trong DAL/Writer.
([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security#bypassing-row-level-security))

| Vai trò | Điều cần xác nhận trên staging/cloud |
| --- | --- |
| Role migration | Đúng owner/quyền ALTER/CREATE/LOCK/TRIGGER; đọc metadata, fingerprint và sequence để hậu kiểm |
| Role server của Next.js | USAGE schema; DML Reader/Writer cũ; quyền SELECT/UPDATE content chương và SELECT/INSERT/UPDATE nội dung cũ để trigger invoker chạy; quyền DELETE cho luồng xóa |
| anon/authenticated | Không owner/bypass; Forum không có policy cho phép hàng; kiểm tra cả quyền TRUNCATE/REFERENCES/TRIGGER ngoài nhu cầu |
| Role Express sau này | Chỉ thiết kế khi cấu hình triển khai được duyệt; không nới gate Local hoặc cấp ALL ở review này |

Migration chỉ ENABLE RLS cho năm bảng Forum, không có GRANT hoặc policy mới.
Tuy vậy, **default privileges của role tạo bảng có thể tự cấp quyền**. SQL audit
đọc global/default theo schema, owner, effective table/column/sequence/function
privileges. Global defaults và phần bổ sung public cần xem cùng nhau; defaults
phụ thuộc current role tạo object, không tự kế thừa từ role thành viên.
([PostgreSQL 17: default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html))

RLS không thay table grants, không áp dụng TRUNCATE/REFERENCES; owner và role
bypass có ngoại lệ. Vì vậy không kết luận Forum an toàn chỉ từ cờ RLS=true.
Nếu anon/authenticated có quyền không phù hợp, dừng để duyệt thay đổi quyền có
phạm vi; không tự sửa quyền Supabase. Forum chưa mở API và chưa có policy nghiệp
vụ. ([PostgreSQL 17: row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html))

Local chỉ có postgres/role dựng sẵn, thiếu anon/authenticated/service_role và đã
bỏ owner/grants khi restore. Audit báo đúng sự vắng mặt này. Kiểm thử deny bằng
role Local trước đây không chứng minh quyền cloud; không tạo role giả để thay
thế bằng chứng. Quyền sequence/function được xuất để review, không tự GRANT
USAGE/EXECUTE công khai theo suy đoán.

## Kiểm thử thực tế

| Kiểm tra trong lượt review | Kết quả |
| --- | --- |
| Root model regression + retry/Writer service tests | **60/60 PASS**: 35 cũ + 15 retry + 10 Writer |
| Backend unit tests | **94/94 PASS** |
| Local transition/Prisma/SQL kiểm tra | **43/43 PASS**: bộ trước + 4 checks mới |
| Deadlock PostgreSQL thật qua helper của Writer | PASS: 40P01 được retry, hai bản nội dung cuối khớp |
| Bốn file SQL mới chạy trong BEGIN READ ONLY | PASS |
| ESLint các file JavaScript thay đổi | PASS |
| git diff --check | PASS |

Writer service tests import trực tiếp service hiện có, thay IO bằng fake client
trong tiến trình test, không đọc env/Supabase và không biến đổi source service.
Chúng xác nhận mỗi content retry giữ cùng chapter_id, không tạo lại metadata,
không tăng counter lặp; thử cạn retry, lỗi UNIQUE/FK và kiểm tra chủ sở hữu.

Database chỉ kiểm thử `127.0.0.1:5432/novely_restore_test`, PostgreSQL 18.3.
Sau test vẫn **21 bảng, 70 index, 14 trigger, 7 hàm trigger**; cả 16 bảng giữ số
dòng/checksum, Forum rỗng, không fixture, 1.054 nội dung khớp, 642 Library NULL và
một truyện thiếu thống kê giữ nguyên. Auto ID test làm sequence tăng bình thường;
không reset. Các SQL fingerprint mới trả 16 aggregate, không trả dữ liệu hàng.

Không chạy lại toàn bộ DDL từ trạng thái 16 bảng: Local hiện đã expand và task
cấm reset/xóa database. Migration không đổi từ d99e41d, đã có dry-run/rollback ở
lượt BE02.4 trước. Không nhận kết quả đó là dry-run mới trên PostgreSQL 17.12.
Không chạy 126 integration/479 SQL cũ nhắm baseline 19 bảng. Không chạy HTTP
PostgREST thật hoặc Next build khi client dependency của workspace chưa đủ.

## File thay đổi

| File | Thay đổi |
| --- | --- |
| `src/server/services/writer.js` | Retry từng câu ghi/xóa chương, giữ nghiệp vụ và kiểm tra quyền |
| `src/server/retry-deadlock.mjs` | Mới: helper giới hạn hai retry cho 40P01 |
| `tests/retry-deadlock.test.mjs` | Mới: kiểm thử helper và các lỗi không được retry |
| `tests/writer-service.test.mjs` | Mới: kiểm thử service thật với IO giả |
| `tests/helpers/writer-server-mocks.mjs` | Mới: boundary test, không credential/network |
| `package.json` | Đưa 25 test mới vào npm test, không đổi dependency/lockfile |
| `backend/transition-tests/migration.test.js` | Dùng helper với deadlock thật; thêm 4 check chỉ đọc |
| `database/checks/supabase-access-audit.sql` | Mới: SQL audit quyền/RLS/default ACL/FK chỉ đọc |
| `database/checks/legacy-preflight.sql` | Mới: gate schema legacy/PG17/scoped trigger |
| `database/checks/legacy-data-fingerprint.sql` | Mới: aggregate checksum dùng trước/sau migration |
| `database/checks/migration-postflight.sql` | Mới: hậu kiểm schema/backfill |
| `docs/supabase-deployment-runbook.md` | Mới: một transaction, dry-run, hậu kiểm, rollback, gates triển khai |
| `docs/backend-predeployment-review.md` | Báo cáo này |
| `database/migrations/README.md`, `backend/README.md`, `docs/database-migration-preparation.md` | Liên kết kết quả review và cập nhật trạng thái retry |

Git: 6 file tracked sửa và 10 file mới trong bảng trên. File cache PowerShell
untracked có sẵn được giữ nguyên. Không sửa Frontend UI, migration đã commit,
Prisma schema hoặc dependency. Không stage, commit/push, không tác động Supabase,
`novely_test` hoặc `novely_reconcile_test`, không thêm API nghiệp vụ.

## Điều kiện để chuyển sang READY

1. CI/staging có đủ dependency và chạy build/Writer smoke với client thật, Next
   Writer là luồng ghi chính, không bật retry toàn bộ workflow ở proxy/UI.
2. Nhóm chạy SQL audit chỉ đọc trên đúng Supabase/role triển khai và xác nhận
   grants/default ACL/RLS; xử lý riêng mọi sai lệch được phát hiện.
3. Dry-run transaction + rollback trên PostgreSQL 17.12 có quyền/cấu hình giống
   Supabase; so 16 fingerprint, sequence và metadata trước/sau.
4. Smoke PostgREST/cache/role sau commit staging; chốt backup/restore/cửa sổ bảo
   trì và người duyệt COMMIT cloud.

Các bước cloud còn thiếu do giới hạn không kết nối Supabase của task, không phải
lỗi Local. Xem [runbook](supabase-deployment-runbook.md) cho lệnh và tiêu chí dừng.

Chạy lại từ root:

```powershell
npm.cmd test
npm.cmd test --prefix backend
npm.cmd run test:transition --prefix backend
node node_modules/eslint/bin/eslint.js src/server/services/writer.js src/server/retry-deadlock.mjs tests/retry-deadlock.test.mjs tests/writer-service.test.mjs tests/helpers/writer-server-mocks.mjs backend/transition-tests/migration.test.js
git diff --check
```
