# Novely Backend — Foundation đến BE02.4

Express 5 chạy độc lập với Frontend Next.js ở thư mục gốc, theo kiến trúc Layered Modular Monolith. BE02.2 bổ sung Prisma Client cho 19 bảng PostgreSQL Local. BE02.3 bổ sung readiness, repository tham chiếu, transaction, xử lý lỗi database và JSON serialization; chưa chuyển API nghiệp vụ, xác thực hoặc upload từ Next.js sang Express.

## Yêu cầu và chạy local

- Node.js >= 24 và npm >= 10. Workspace hiện dùng Node.js 24.
- Chạy các lệnh sau từ thư mục gốc repository. Trên PowerShell, dùng `npm.cmd` nếu `npm.ps1` bị chặn.

```powershell
npm.cmd ci --prefix backend
if (-not (Test-Path -LiteralPath backend/.env)) {
  Copy-Item -LiteralPath backend/.env.example -Destination backend/.env
}
npm.cmd run dev --prefix backend
```

Chỉ sao chép `.env.example` khi chưa có `backend/.env`; giữ cấu hình riêng đã có. HTTP server và liveness `/api/v1/health` vẫn chạy với giá trị mặc định, không cần tạo `.env`, generate Client hoặc kết nối database. Readiness `/api/v1/health/ready` trả 503 nếu database/config/Client chưa sẵn sàng. Các lệnh Prisma và kiểm thử tích hợp cần DATABASE_URL hợp lệ như hướng dẫn bên dưới.

Chạy không có chế độ theo dõi file:

```powershell
npm.cmd start --prefix backend
```

Mở `http://localhost:4000/api/v1/health`, hoặc:

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health
```

Frontend tiếp tục chạy bằng lệnh hiện có ở root, ví dụ `npm.cmd run dev`, thường ở cổng 3000. Lệnh root không tự khởi động Express. Dừng Backend bằng Ctrl+C.

## Cấu hình môi trường

Node.js tự nạp **backend/.env** bằng `process.loadEnvFile()`. Đường dẫn được tính theo file module, nên chạy từ root hay `backend/` đều không nạp nhầm `.env` của Frontend. Biến đã đặt trong môi trường tiến trình được ưu tiên hơn file. Không có `.env` thì dùng mặc định; cấu hình không hợp lệ khiến tiến trình thoát với mã 1.

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `NODE_ENV` | `development` | Nhận `development`, `test`, `production` |
| `PORT` | `4000` | Số nguyên từ 1 đến 65535 |
| `CORS_ORIGINS` | localhost và 127.0.0.1, cổng 3000/3100 | Danh sách HTTP/HTTPS origin, phân cách bằng dấu phẩy |
| `DATABASE_URL` | Không có; ví dụ trong `.env.example` | Dùng cho Prisma, readiness và integration test; khóa đích Local `127.0.0.1:5432/novely_reconcile_test`, schema public |

CORS trả origin cụ thể và hỗ trợ credentials cho origin được cấu hình; origin khác nhận JSON 403. Preflight được xử lý bởi middleware. Request không có `Origin` (CLI/server) vẫn được chấp nhận. CORS chưa phải cơ chế xác thực người dùng.

JSON request có giới hạn 100 KB; JSON sai nhận 400, payload quá lớn nhận 413, charset/encoding không hỗ trợ nhận 415. Lỗi nội bộ trả thông báo chung, không trả stack hoặc nội dung request. Express 5 chuyển lỗi/rejection của async handler về middleware xử lý lỗi; không cần thêm thư viện bọc async.

## API hiện có

`GET /api/v1/health` trả HTTP 200, `Cache-Control: no-store` và:

```json
{
  "data": {
    "status": "ok",
    "service": "novely-backend",
    "timestamp": "2026-11-25T00:00:00.000Z",
    "uptime": 12
  }
}
```

`timestamp` là thời điểm UTC hiện tại; `uptime` là số giây tiến trình đã chạy. Endpoint này chỉ kiểm tra tiến trình Express, không xác nhận kết nối database.

`GET /api/v1/health/ready` kiểm tra kết nối bằng truy vấn đọc qua
Route → Controller → Service → Repository → Prisma → PostgreSQL. Trả 200 khi sẵn sàng:

```json
{ "data": { "status": "ready", "service": "novely-backend" } }
```

Nếu kết nối lỗi, chưa generate Client hoặc hết thời gian, trả HTTP 503 với
`error.code=DATABASE_UNAVAILABLE`. Cả hai trường hợp dùng `Cache-Control: no-store`.
Endpoint không trả URL/host/user hay SQL, không đọc dữ liệu nghiệp vụ và không ghi dữ liệu.
Thời hạn phản hồi là 2 giây; probe dùng transaction READ ONLY với SQL timeout
1 giây, chờ transaction tối đa 1 giây và transaction timeout 1,5 giây. Các request
đồng thời chia sẻ một probe còn chạy, không tiếp tục tạo query khi probe cũ chưa kết thúc.

Đường dẫn/phương thức chưa được triển khai trả JSON 404. Định dạng lỗi giữ theo Backend Next.js hiện có:

```json
{ "error": { "code": "NOT_FOUND", "message": "Không tìm thấy đường dẫn API." } }
```

## Cấu trúc và trách nhiệm

```text
backend/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── package-lock.json
├── prisma.config.mjs          # Cấu hình Prisma 7, nạp riêng backend/.env
├── prisma/
│   ├── schema.prisma          # 19 model introspected, @map/@@map
│   └── README.md              # Giới hạn PostgreSQL và báo cáo BE02.2
├── scripts/
│   ├── prisma.js              # CLI validate/generate/format/introspect, che secret
│   ├── snapshot-database.js   # Chụp metadata đọc, không chụp dữ liệu người dùng
│   ├── lib/catalog.js
│   └── sql/catalog-snapshot.sql
├── src/
│   ├── app.js                 # Cấu hình Express, không mở cổng
│   ├── server.js              # Nạp môi trường, mở cổng, tắt server
│   ├── routes.js              # Router /api/v1
│   ├── config/env.js
│   ├── config/database.js     # Kiểm tra URL Local, cấu hình pool
│   ├── database/prisma.js     # getPrisma()/disconnectDatabase(), khởi tạo trễ
│   ├── database/transaction.js # Service chọn transaction, truyền client cho repository
│   ├── generated/prisma/      # Client tự generate, gitignore
│   ├── middlewares/
│   │   ├── cors.js
│   │   ├── error-handler.js
│   │   └── not-found.js
│   ├── shared/errors/api-error.js
│   ├── shared/errors/database-error.js # Prisma/SQLSTATE → HTTP, thông báo an toàn
│   ├── shared/http/json.js    # BigInt/Date/null, bỏ passwordHash/password_hash
│   └── modules/
│       ├── health/            # routes → controller → service → repository
│       ├── users/
│       ├── novels/
│       ├── chapters/
│       ├── library/bookshelf.repository.js # Repository tham chiếu, chưa có API
│       ├── reading/
│       └── forum/
├── integration/
│   ├── prisma.test.js          # 77 test BE02.2, truy vấn đọc
│   ├── express-database.test.js # 49 test BE02.3, CRUD/transaction/trigger
│   └── helpers/              # Fixture và HTTP harness chỉ dành cho test
└── tests/                    # Không cần database
    ├── app.test.js
    ├── env.test.js
    ├── database.test.js
    ├── database-errors.test.js
    ├── readiness.test.js
    ├── repository-transaction.test.js
    ├── serialization.test.js
    ├── server.test.js
    └── helpers/http.js
```

Health có repository riêng cho readiness; Library chỉ có repository tham chiếu,
chưa có route/service nghiệp vụ. Các module còn lại vẫn là thư mục dành chỗ.
Luồng thống nhất: `routes → controller → service → repository → Prisma → PostgreSQL`.
Liveness không gọi repository. Các module cùng chạy trong một ứng dụng Express.

Giữ Supabase làm nền tảng PostgreSQL và lưu ảnh của dự án; BE02.2 chỉ kết nối database Local đã nghiệm thu. Logic `jose`, `bcryptjs`, Zod, dịch vụ và Storage trong `src/` của Next.js được giữ nguyên để tái sử dụng ở task tương ứng. Khi chuyển module, cần thay các phụ thuộc Next.js như `next/headers`, `next/cache`, `server-only` và alias `@/` bằng adapter phù hợp; không import trực tiếp chúng vào Express.

## Prisma ORM Foundation

Prisma CLI, Client và `@prisma/adapter-pg` cố định **7.10.1**, driver `pg` **8.23.1**. Backend giữ JavaScript ES Modules. Generator `prisma-client-js` hiện còn được hỗ trợ trong Prisma 7, xuất JavaScript dùng được trực tiếp từ ESM, có trạng thái deprecated cần xem lại khi nâng major sau này.

Nhập DATABASE_URL thật vào `backend/.env` bằng trình soạn thảo, dùng ví dụ đã che mật khẩu trong `.env.example`. Không ghi URL thật vào Terminal command, README hoặc Git. Không dùng Supabase URL trong BE02.2. Các lệnh dưới đây chạy từ root:

```powershell
npm.cmd run db:validate --prefix backend
npm.cmd run db:generate --prefix backend
npm.cmd run db:snapshot --prefix backend
npm.cmd run test:db --prefix backend
```

`db:snapshot` chỉ đọc định nghĩa bảng/cột/ràng buộc/index/trigger/function, quyền,
policy, sequence và số dòng; lưu baseline được gitignore tại `backend/.local/`.
Tạo baseline trước lần introspect đầu tiên; giữ nguyên baseline trong cả lượt đối
chiếu. Chỉ chụp lại khi chủ động bắt đầu lượt đối chiếu mới trên database đã xác nhận.

Schema đã được introspect và đặt tên model/cột rõ ràng. Khi cần đối chiếu lại với
Local, dùng `npm.cmd run db:introspect --prefix backend`; lệnh chỉ đọc database,
có ghi lại file schema.prisma, cần xem Git diff sau đó. Các lệnh Prisma không
cung cấp db push, migrate/reset hoặc seed. Migration SQL chuyển tiếp BE02.4
được tách riêng và chỉ cho phép chạy trên `novely_restore_test` qua tool Local.

Repository tương lai lấy Client bằng `const prisma = await getPrisma()` từ
`src/database/prisma.js`. Các lời gọi đồng thời trong một tiến trình chia sẻ một
Client và một pool, tối đa 5 connection. Không khởi tạo Client hoặc disconnect sau
mỗi request. Khi tắt server, HTTP đóng trước, sau đó `$disconnect()` và `pool.end()`;
script độc lập phải gọi `disconnectDatabase()` trong finally.

Pool có connection timeout 5 giây, idle timeout 10 giây và statement timeout
15 giây. Các session của pool dùng UTC để xử lý đúng timestamptz với adapter
Prisma 7; không thay cấu hình PostgreSQL toàn cục. Xem [báo cáo và các giới hạn ánh xạ](prisma/README.md)
trước khi viết bất kỳ migration hoặc API nghiệp vụ nào.

## Repository và transaction

`createBookshelfRepository({ getClient })` hỗ trợ dependency injection và các
thao tác find/create/updateStatus/remove theo khóa `(userId, novelId)`. Mỗi hàm
nhận tùy chọn `{ transaction }`; nếu có, chỉ dùng client đó, không lấy root client.
Repository chỉ chọn cột công khai, không tăng counter trong code.

Service chủ động mở transaction khi nhiều thao tác cần thành công hoặc thất bại
cùng nhau. Ví dụ quy ước cho module sau này, chưa được mount thành API:

```javascript
const repository = createBookshelfRepository();
await withTransaction(async (transaction) => {
  await repository.create({ userId, novelId }, { transaction });
  await repository.updateStatus(userId, novelId, "reading", { transaction });
});
```

`withTransaction` nằm ở `src/database/transaction.js`, mặc định maxWait=2 giây,
timeout=5 giây, cho phép truyền options hoặc transaction đang có. Callback lỗi
được ném nguyên vẹn để Prisma rollback và middleware phân loại. Không tự mở
transaction cho mọi request, không tự retry callback có thể có tác dụng bên ngoài.

JSON trả BigInt thành chuỗi thập phân, Date thành ISO 8601, giữ null, loại cả
`passwordHash` và `password_hash` ở mọi cấp. Không sửa BigInt.prototype. Các module
vẫn phải select/projection an toàn; replacer là lớp bảo vệ cuối.

Xem [báo cáo BE02.3](docs/be02_3-express-database-integration.md) để biết bảng lỗi HTTP,
phương án fixture/commit/cleanup và kết quả kiểm thử đầy đủ.

## Kiểm thử

```powershell
npm.cmd test --prefix backend
```

Dùng `node:test`, `assert` và HTTP server thật ở cổng ngẫu nhiên; `npm test` không cần Supabase, credential, test database hay cổng 4000 còn trống. Hiện có **94 tests**: 60 test trước đây và 34 test mới BE02.3. Integration test được tách riêng trong `integration/`, chỉ chạy qua các lệnh DB bên dưới.

```powershell
npm.cmd run test:db:prisma --prefix backend # 77 test đọc BE02.2
npm.cmd run test:db:http --prefix backend   # 49 test Express/CRUD BE02.3
npm.cmd run test:db --prefix backend        # 126 test, chạy hai file tuần tự
```

Test ghi yêu cầu cả 19 bảng Local rỗng và catalog khớp baseline BE02.2. Phần lớn
fixture nằm trong transaction/savepoint rồi rollback. Ca commit thật dùng ID
âm riêng và marker tổng hợp; kiểm tra từ connection khác rồi cleanup trong finally.
Bảng IDENTITY được nạp bằng Prisma raw SQL với `OVERRIDING SYSTEM VALUE`, các
bảng composite dùng Prisma Model.create; không gọi nextval hoặc reset sequence.
HTTP CRUD thử nghiệm chỉ tồn tại trong test harness, server chính thức trả 404.

Kết quả BE02.3: 94 unit + 126 integration + 479 SQL đều PASS; sau test còn đúng
19 bảng rỗng, 57 index, 11 trigger, 4 function, cả 10 sequence chưa sử dụng.

Để chạy bộ model test Frontend hiện có, dùng `npm.cmd test` từ root.

## Migration chuyển tiếp BE02.4

Database phục hồi `novely_restore_test` đã được nâng từ 16 lên **21 bảng** trên
Local, giữ hai bảng legacy và dữ liệu để Next.js tiếp tục hoạt động. Database
`novely_reconcile_test` vẫn là baseline 19 bảng của BE02.2/3, không được chỉnh
sửa trong BE02.4. Runtime Express và Client chính tiếp tục giữ cấu hình cũ.

Library cũ giữ `reading_status = NULL` theo xác nhận người dùng. Client chính
khai báo trạng thái bắt buộc, vì vậy BE02.4 tạo Prisma schema/Client chuyển tiếp
riêng, chưa chuyển cấu hình runtime Express sang database có dữ liệu này.

Chạy từ root:

```powershell
npm.cmd run db:transition:validate --prefix backend
npm.cmd run db:transition:generate --prefix backend
npm.cmd run test:transition --prefix backend
```

Tool dùng credential Local trong `backend/.env` ở bộ nhớ, chỉ kết nối
`127.0.0.1:5432/novely_restore_test` và xác minh lại database qua SQL. Không cần
đổi DATABASE_URL của ứng dụng hoặc nạp `.env` Frontend. Client riêng được sinh
trong `src/generated/prisma-transition/`; báo cáo tổng hợp/test log ở `.local/`,
đều được gitignore.

`db:transition:check` và `db:transition:apply` chỉ dùng cho bản restore nguyên
trạng 16 bảng; database hiện tại đã apply sẽ bị chặn chạy lại. Bộ 39 test chuyển
tiếp tách khỏi 94 unit test và 126 integration test baseline. Nó thử auto ID thật
nên sequence tăng dù fixture được rollback/dọn sạch; không reset sequence.

Xem [báo cáo BE02.4](../docs/database-migration-preparation.md) và
[hướng dẫn migration, rollback và triển khai có phê duyệt](../database/migrations/README.md).
Hai luồng ghi chương có thể deadlock và cần chính sách writer/retry trước vận
hành đồng thời; test Local không thay thế kiểm thử PostgreSQL 17, quyền Supabase
hoặc PostgREST. BE02.4 không kết nối Supabase và chưa chuyển API nghiệp vụ.

## Tài liệu tham khảo

- [Express 5 — Error handling](https://expressjs.com/en/5x/guide/error-handling/)
- [Express — CORS middleware](https://expressjs.com/en/resources/middleware/cors/)
- [Node.js — process.loadEnvFile](https://nodejs.org/docs/latest-v24.x/api/process.html#processloadenvfilepath)

