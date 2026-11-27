# BE02.3 — Express Database Integration

Kết luận: **PASS**, kiểm thử ngày 25/11/2026 trên branch
`feature/backend-foundation`, chỉ sử dụng `127.0.0.1:5432/novely_reconcile_test`.

## Audit và phạm vi

Đã đọc app.js, server.js, Prisma Client dùng chung, config database, toàn bộ
middleware/shared/module hiện có, Prisma schema và SQL nguồn. Thư mục thực tế
là `src/middlewares/` (số nhiều). Backend trước task chỉ có Health cùng các thư
mục module dành chỗ; chưa có repository/transaction wrapper hoặc readiness.

Node 24.18.0, npm 11.16.0, Prisma CLI/Client/adapter 7.10.1, pg 8.23.1,
PostgreSQL 18.3. Không cài dependency mới, không thay phiên bản hoặc lockfile.
Giữ nguyên Client, pool/lifecycle, cấu hình Local/UTC và hai schema đã nghiệm thu.

Trước khi ghi fixture, đã xác nhận branch, .env được gitignore, URL đúng đích
Local, kết nối thật, 19 bảng rỗng và metadata khớp BE02.2. Không in URL/mật khẩu.

## Repository Layer

Luồng readiness thật:

```text
HTTP /api/v1/health/ready
  → health.routes → health.controller → health.service
  → health.repository → transaction/shared Prisma → PostgreSQL
```

`createHealthRepository({ getClient })` chỉ kiểm tra `SELECT 1` trong transaction
READ ONLY. Đây là repository hạ tầng, không đọc dữ liệu người dùng.

`createBookshelfRepository({ getClient })` là repository nghiệp vụ tham chiếu
tối thiểu. Có find/create/updateStatus/remove, dùng model Bookshelf và composite
key `userId_novelId`, select cột Library và các trường công khai của user/novel.
Không lấy passwordHash/email, không tăng counter trong repository.

Mỗi hàm nhận `{ transaction }`. Nếu được truyền, repository dùng chính client
này; nếu không mới gọi getClient (mặc định getPrisma). Test dùng root provider
cố ý báo lỗi nếu bị gọi để chứng minh truy vấn không thoát transaction.

Library chưa có route/service nghiệp vụ trong app thật. Controller/service/router
CRUD chỉ ở `integration/helpers/http-database-harness.js`, không được import
bởi app.js hoặc routes.js. Test xác nhận server thật trả 404 cho các đường thử.

## Transaction

`createTransactionRunner({ getClient })` và `withTransaction` nằm trong
`src/database/transaction.js`. Service chọn ranh giới transaction, nhận client
rồi truyền cùng client cho mọi repository liên quan.

Mặc định maxWait=2000ms, timeout=5000ms, cho phép options Prisma như
isolationLevel/timeout. Nếu có `{ transaction }`, chỉ dùng lại callback/client,
không mở nested transaction hoặc tự tạo savepoint. Lỗi callback được ném nguyên
vẹn; không bắt lỗi rồi trả thành công, không tự retry, không bọc mọi HTTP request.

Kiểm thử commit thật đã thực hiện cùng transaction: tạo cha fixture có ID tường
minh, create/update Bookshelf, tạo NovelLike và Follow. Connection kiểm toán
khác không thấy dữ liệu trước commit và thấy đầy đủ sau commit.

Transaction kế tiếp sửa Library, thêm like/follow rồi cố ý tạo Library trùng.
Unique error làm rollback tất cả; connection kiểm toán thấy status/counter/quan
hệ vẫn như trước. Các fixture commit được xóa trong finally theo ID **và**
username/email/slug tổng hợp đã dành riêng, không xóa bằng điều kiện rộng.

## Ánh xạ lỗi database → HTTP

Đã tái hiện lỗi thật trong transaction rollback trước khi thiết kế mapper.
Không giả định chỉ cần đọc error.code hoặc mọi lỗi có cùng một dạng.

| Trường hợp | Dạng thực tế đã quan sát | HTTP / mã công khai |
| --- | --- | --- |
| Unique | P2002, cause.originalCode=23505 | 409 / UNIQUE_CONSTRAINT |
| Foreign key | P2003, cause.originalCode=23503 | 409 / FOREIGN_KEY_CONSTRAINT |
| RESTRICT | P2003, cause.originalCode=23001, kind=RestrictViolation | 409 / FOREIGN_KEY_CONSTRAINT |
| Không tìm thấy bản ghi | P2025 khi update bản ghi không tồn tại | 404 / RECORD_NOT_FOUND |
| CHECK | P2039 + meta.driverAdapterError.cause.code/originalCode=23514 | 422 / CHECK_CONSTRAINT |
| Kết nối/xác thực PostgreSQL | P2010 + cause.originalCode=28P01, kind=AuthenticationFailed | 503 / DATABASE_UNAVAILABLE |
| Lỗi SQL ngoài dự kiến | P2010 + cause.originalCode=22012 (chia 0) | 500 / INTERNAL_ERROR |

Mapper còn hỗ trợ initialization error.errorCode, native SQLSTATE, network/pool
timeout và các dạng nested cause cũ. NOT NULL/out-of-range được trả 422 INVALID_DATA.
P2039 chưa rõ nguyên nhân không tự động bị coi là CHECK; lỗi lập trình hoặc SQL
không nhận diện giữ 500. DB authentication là lỗi kết nối của Backend nên 503,
không phải HTTP 401 dành cho người dùng đăng nhập.

Chỉ duyệt các trường code/errorCode/originalCode/sqlState trong các nhánh
meta/cause/driverAdapterError có giới hạn và chống vòng lặp. Không parse thông báo
SQL để đoán mã. Client chỉ nhận `{error:{code,message}}` với thông báo cố định.
Log request cho lỗi database 5xx chỉ chứa mã Prisma/SQLSTATE; không ghi raw error,
stack, SQL, URL hoặc password. ApiError 4xx và body-parser error BE01 vẫn giữ
hợp đồng trước đây.

Lỗi kết nối thật được tạo bằng một client **chỉ trong test**, cùng Local DB,
credential tổng hợp sai chỉ ở RAM. Không thay backend/.env, không đổi pg_hba hoặc
tắt PostgreSQL. Client/pool test được disconnect/dispose; production tiếp tục
chỉ dùng shared getPrisma().

## JSON serialization

`src/shared/http/json.js` cấu hình json replacer cho Express:

- BigInt → chuỗi thập phân, giữ chính xác cả số vượt Number.MAX_SAFE_INTEGER.
- Date hợp lệ → ISO 8601 theo Date.toJSON tiêu chuẩn.
- null giữ nguyên, kể cả trong object/array lồng nhau.
- Bỏ passwordHash và password_hash ở mọi cấp, bổ sung cho projection an toàn.
- Không sửa object gốc hoặc BigInt.prototype.

Đã kiểm tra HTTP bằng comment ID BigInt thật lớn hơn giới hạn số nguyên an toàn
về độ lớn, Date và parentId=null. Test cố ý đưa hash tổng hợp qua repository thử
để xác nhận lớp bảo vệ cuối loại được cả hai cách đặt tên.

## Health và readiness

GET /api/v1/health giữ nguyên nội dung/hành vi BE01, không truy cập DB.
GET /api/v1/health/ready trả 200 `{data:{status:'ready',service:'novely-backend'}}`
hoặc 503 `{error:{code:'DATABASE_UNAVAILABLE',message:'Cơ sở dữ liệu chưa sẵn sàng.'}}`.
Cả hai kết quả readiness đều no-store, không trả thông tin kết nối.

Service có deadline 2000ms; repository dùng transaction READ ONLY với maxWait
1000ms, timeout 1500ms, SET LOCAL statement_timeout='1000ms'. Cấu hình này chỉ
trong transaction, không ALTER DATABASE/SYSTEM. Các request đang chạy chung một
probe để tránh tạo thêm truy vấn khi probe cũ chưa kết thúc; không cache kết quả
thành công/lỗi cho request tiếp theo. Unit test tái hiện provider treo mà không
cần database; integration kiểm tra 200 và 503 thật qua Express.

## CRUD/trigger và cô lập dữ liệu

Test ghi chỉ chạy khi 19 bảng Local rỗng, catalog đúng baseline và lấy được
session advisory lock 230003 dành cho BE02.3. Hai file integration chạy tuần tự
bằng --test-concurrency=1. Không chạy song song một bộ SQL ghi khác trên DB này.

Phần lớn fixture dùng transaction ngoài và SAVEPOINT riêng mỗi case rồi rollback.
ID int/smallint âm và BigInt ngoài giới hạn Number được khai báo tập trung trong
be02_3-fixtures.js. Các bảng IDENTITY được nạp qua Prisma raw SQL
INSERT ... OVERRIDING SYSTEM VALUE. Các thao tác Model.create thực tế dùng
Bookshelf/NovelLike/Follow/ReadingProgress/ForumReaction có PK composite.

Đã kiểm tra INSERT/UPDATE/DELETE counter NovelLike/Follow; INSERT qua Prisma SQL,
model UPDATE/DELETE, soft delete/restore/chuyển chương của Comment; updated_at
trên cả 8 bảng; rollback hoàn tác counter. Repository/service không ghi counter.
Đã kiểm tra composite FK cùng truyện/chương/bài Forum; CASCADE user/novel/chapter/
comment, RESTRICT author/genre và NO ACTION Forum. Xóa chapter qua Prisma model
chỉ đặt reading_progress.chapter_id=NULL, giữ novel_id, tỷ lệ và pixel.

Chưa kiểm thử Model.create tự sinh ID trên bảng IDENTITY vì sẽ gọi nextval mà
rollback không hoàn tác được. Các test hiện tại không gọi nextval/setval/reset;
không được diễn giải rollback là có khả năng hoàn tác sequence.

## Regression thực tế

| Bộ kiểm tra | Kết quả |
| --- | --- |
| Prisma validate | PASS, cảnh báo partial SetNull đã biết từ BE02.2 |
| Prisma generate | PASS, Client 7.10.1 |
| Backend unit | 94/94 = 60 baseline + 34 mới |
| Prisma integration BE02.2 | 77/77 |
| Express Database integration mới | 49/49 |
| Toàn bộ integration, tuần tự | 126/126 |
| Database BE02.1, reuse_schema=true | 479/479, không nạp DDL |
| npm audit | 0 vulnerabilities |
| git diff --check | PASS |

Số test node:test bao gồm test cha của các bộ integration. Không cài thêm
dependency để viết test, vẫn dùng node:test/assert/HTTP thật.

## Database sau kiểm thử

19 bảng rỗng, 57 index, 11 trigger ứng dụng, 4 hàm trigger. Các định nghĩa cột,
default, constraints, grants, RLS/policies và **trạng thái 10 sequence** khớp trước
task. Cả 10 sequence vẫn last_value=null/chưa sử dụng. Không reset sequence.

Metadata fingerprint trước/sau:
`8e1c749a7f67d213bd2ef09cf265b28f6d5fcf0d81a7eb7b2ace5e63029ff66e`.

SQL nguồn SHA-256 không đổi:
`b941d3b3dca623a661c129b8ced8651e76d1c382b149b3725dcfea8212964ae4`.
Prisma schema SHA-256 không đổi:
`c091574e9423b110d3bfe0cb28ed4b27ed62a11994d2adea6537b0238006f123`.

Bằng chứng được gitignore trong backend/.local/:
be02_3-before.json, be02_3-error-shapes.json (chỉ mã/kiểu lỗi, không raw message),
be02_3-result.json, be02_3-sql-regression.log và be02_3-final-audit.json.

## Rủi ro trước migration Supabase

1. Local đang dùng postgres có quyền rộng. Chưa kiểm chứng app role, grants/RLS,
   pooler/TLS và quyền cần cho trigger SECURITY INVOKER trên cloud. SELECT 1
   readiness không chứng minh toàn bộ quyền đọc/ghi nghiệp vụ.
2. Prisma schema không thay thế CHECK, trigger, IDENTITY ALWAYS và SET NULL theo
   cột. Không dùng migrate/db push tự động để tái tạo schema đã nghiệm thu.
3. Giữ nguồn SQL và kế hoạch copy nguyên văn chapter_contents, lưu trữ dữ liệu
   chapter_likes, đối soát counter/thống kê thiếu theo báo cáo BE02.1. Chưa chạy
   migration cloud hoặc chuyển các query Next.js sang cấu trúc mới.
4. Giữ UTC của pool để tránh lỗi adapter Prisma 7; quy định rõ ngày nghiệp vụ
   theo múi giờ Việt Nam và giới hạn độ chính xác JS Date/Real/BigInt khi viết API.
5. API nghiệp vụ tiếp theo cần authentication/authorization và validation đầu
   vào, luôn truyền đúng transaction client. Chưa kiểm thử tải/khóa chéo nhiều
   người dùng hoặc retry transaction có idempotency; không tự retry mọi callback.

## Chạy lại

Từ C:\Novely\Novely, giữ nguyên backend/.env đã cấu hình; PostgreSQL Local đang
chạy, Client đã generate. Khi clone mới thiếu baseline, dùng db:snapshot **trước**
lượt thay đổi/test, không ghi đè baseline giữa một lượt đối chiếu để test qua.

```powershell
npm.cmd run db:validate --prefix backend
npm.cmd run db:generate --prefix backend
npm.cmd test --prefix backend
npm.cmd run test:db --prefix backend
& .\database\tests\run-be02_1.ps1 -ReuseSchema
npm.cmd audit --prefix backend
git diff --check
```

PS1 hỏi mật khẩu trực tiếp trong Terminal; không gửi vào chat hoặc gắn vào URL
trên command line. Có thể chạy riêng test:db:prisma và test:db:http. Không dùng
reset, seed, migrate hoặc db push để chuẩn bị test. Nếu có dữ liệu ngoài dự kiến,
suite ghi dừng; kiểm tra các ID/marker trong fixtures và báo cáo Local trước mọi
cleanup, không tự xóa toàn DB. Ca commit có finally; khi tiến trình bị kill cứng,
finally không được đảm bảo chạy và cần rà soát fixture có kiểm soát.

Kiểm tra endpoint khi đã chạy npm.cmd run dev --prefix backend:

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health
Invoke-RestMethod http://localhost:4000/api/v1/health/ready
```

## Danh sách file và Git status

8 file sửa:

- backend/README.md
- backend/package.json
- backend/src/app.js
- backend/src/routes.js
- backend/src/middlewares/error-handler.js
- backend/src/modules/health/health.controller.js
- backend/src/modules/health/health.routes.js
- backend/src/modules/health/health.service.js

14 file mới:

- backend/docs/be02_3-express-database-integration.md
- backend/src/database/transaction.js
- backend/src/modules/health/health.repository.js
- backend/src/modules/library/bookshelf.repository.js
- backend/src/shared/errors/database-error.js
- backend/src/shared/http/json.js
- backend/tests/database-errors.test.js
- backend/tests/readiness.test.js
- backend/tests/repository-transaction.test.js
- backend/tests/serialization.test.js
- backend/integration/express-database.test.js
- backend/integration/helpers/be02_3-fixtures.js
- backend/integration/helpers/connection-failure.js
- backend/integration/helpers/http-database-harness.js

Không stage/commit/push hoặc đổi branch. Cache
Microsoft/Windows/PowerShell/ModuleAnalysisCache là untracked đã có trước task,
được giữ nguyên ngoài phạm vi thay đổi. Không sửa schema SQL/Prisma, dependency,
Frontend/Next.js, Supabase hoặc triển khai Authentication/API nghiệp vụ đầy đủ.
Dừng sau BE02.3.

## Tham khảo

- [Prisma 7 error reference](https://www.prisma.io/docs/orm/v7/reference/error-reference)
- [Prisma interactive transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)
- [Giới hạn PostgreSQL/Prisma đã ghi nhận ở BE02.2](../prisma/README.md)
- [Kế hoạch reconciliation và bảo toàn dữ liệu](../../docs/database-reconciliation.md)
