# Novely Backend — Foundation và BE03.2 Authentication

Express 5 chạy độc lập với Frontend Next.js ở thư mục gốc, theo kiến trúc Layered Modular Monolith. Foundation cung cấp Prisma, readiness, transaction và cấu hình Supabase chỉ đọc. BE03.2 bổ sung bốn API Authentication trên Local; Frontend chưa chuyển sang Express, User API và upload chưa triển khai.

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

Node.js tự nạp **backend/.env** bằng `process.loadEnvFile()`. Đường dẫn được tính theo file module, nên chạy từ root hay `backend/` đều không nạp nhầm `.env` của Frontend. Biến đã đặt trong môi trường tiến trình được ưu tiên hơn file; có thể dùng Node `--env-file` để nạp cấu hình runtime ngoài Git mà vẫn giữ backend/.env Local. Không có `.env` thì dùng mặc định; cấu hình không hợp lệ khiến tiến trình thoát với mã 1.

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `NODE_ENV` | `development` | Nhận `development`, `test`, `production` |
| `PORT` | `4000` | Số nguyên từ 1 đến 65535 |
| `AUTH_SECRET` | Không có | Tối thiểu 32 ký tự, server-only; phải trùng Next.js khi dùng chung cookie. Thiếu/sai secret khiến thao tác Auth cần ký/xác minh token trả 500; không tạo tài khoản dở dang. Liveness không phụ thuộc secret |
| `CORS_ORIGINS` | localhost và 127.0.0.1, cổng 3000/3100 | Danh sách HTTP/HTTPS origin, phân cách bằng dấu phẩy |
| `DATABASE_PROFILE` | `local` | `local`: baseline 19 bảng; `local-transition`: restore 21 bảng; `supabase`: runtime Foundation chỉ đọc qua TLS |
| `DATABASE_URL` | Không có; ví dụ trong `.env.example` | Đích phải khớp profile, schema public; không cho SSL/options ghi đè trong URL |
| `SUPABASE_PROJECT_REF`, `SUPABASE_DB_HOST`, `SUPABASE_DB_ROLE` | Không có | Bắt buộc với Supabase; project/host đã duyệt và role runtime riêng, không dùng tài khoản quản trị |
| `DATABASE_CA_FILE` | Không có | Đường dẫn tuyệt đối tới CA tin cậy; Supabase bắt buộc xác minh certificate và hostname |

CORS trả origin cụ thể và hỗ trợ credentials cho origin được cấu hình; origin khác nhận JSON 403. Preflight được xử lý bởi middleware. Request không có `Origin` vẫn được phép ở endpoint đọc; mọi POST Auth bắt buộc có Origin chính xác trong allowlist, kể cả CLI/server. CORS không thay thế kiểm tra CSRF hoặc xác thực.

JSON request có giới hạn 100 KB; JSON sai nhận 400, payload quá lớn nhận 413, charset/encoding không hỗ trợ nhận 415. Lỗi nội bộ trả thông báo chung, không trả stack hoặc nội dung request. Express 5 chuyển lỗi/rejection của async handler về middleware xử lý lỗi; không cần thêm thư viện bọc async.

## API hiện có

### Authentication (BE03.2, Local)

| Endpoint | JSON input | Kết quả |
| --- | --- | --- |
| `POST /api/v1/auth/register` | `username, email, password, confirmPassword, agreeTerms:true` | 201 `{data:{user:SessionUser}}`, cookie 1 ngày |
| `POST /api/v1/auth/login` | `identifier, password, rememberMe:boolean=false` | 200 `{data:{user:SessionUser}}`, cookie 1 hoặc 30 ngày |
| `POST /api/v1/auth/logout` | Không yêu cầu body/session hợp lệ | 200 `{data:{ok:true}}`, xóa cookie |
| `GET /api/v1/auth/me` | Cookie tùy chọn | 200 `{data:SessionUser hoặc null}`; lỗi DB không bị biến thành null |

SessionUser chỉ gồm `id, username, role, avatar, expiresAt` (milliseconds). Không trả token,
email, password hash hoặc raw Prisma record. Role lấy từ DB, không từ body hoặc claim JWT.
Mọi response đi qua Auth router có `Cache-Control:no-store`. Cookie `novely_session`
dùng HS256, HttpOnly, SameSite=Lax, Path=/, không Domain, Secure khi NODE_ENV=production.
Logout xóa cookie ở cùng scope; JWT đã sao chép vẫn có hiệu lực đến hết hạn như Next hiện tại.
Không có refresh token/revocation store trong phạm vi này.

POST phải gửi `Origin` thuộc `CORS_ORIGINS`; JSON boolean thay cho checkbox `on`.
Thông báo validation/login/trùng tài khoản giữ như Next; HTTP lần lượt 400/401/409.
Origin sai/thiếu trả 403, lỗi kết nối DB trả 503. Input role/ID/hash không được dùng để ghi.

Chạy với cấu hình Local sẵn có trong `backend/.env`, bổ sung AUTH_SECRET ngoài Git.
Để dùng schema 21 bảng, chọn `DATABASE_PROFILE=local-transition` và URL Local
`127.0.0.1:5432/novely_restore_test`; không thay URL bằng production.
Client transition phải được generate theo hướng dẫn Foundation đã có.
Đặt cùng AUTH_SECRET với Next khi kiểm tra cookie giữa hai server; backend không tự nạp env Frontend.
Việc chuyển Server Actions/BFF và phản chiếu Set-Cookie về browser cần phê duyệt riêng.

Chỉ chạy bộ Auth, từ root:

```powershell
npm.cmd run test:auth --prefix backend
```

Bộ này yêu cầu `backend/.env` vẫn là profile `local` với credential Local đã duyệt;
tự pin đích `novely_restore_test`, dùng Prisma transition, và từ chối Supabase trước kết nối.
Fixture có prefix ngẫu nhiên, được dọn khi kết thúc; sequence Local có thể tăng do INSERT/rollback.
Không reset database hoặc chạy migration. Báo cáo: [BE03.2](../docs/be03-2-authentication-acceptance.md).

**Giới hạn bcrypt được giữ để tương thích:** validation vẫn 6–200 ký tự khi đăng ký,
1–200 khi login, nhưng bcrypt chỉ xử lý 72 byte UTF-8 đầu. Mật khẩu khác nhau sau
72 byte có thể cùng khớp. Chưa thay validation/hash; cần quyết định tương thích riêng trước khi đổi.
Production Foundation vẫn chỉ đọc genres, chưa được cấp quyền Auth hoặc bật write mode.
Không dùng bốn API này trên production trước review quyền/RLS và cutover riêng.

### Health

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
trạng 16 bảng; database hiện tại đã apply sẽ bị chặn chạy lại. Bộ 43 test chuyển
tiếp tách khỏi 94 unit test và 126 integration test baseline. Nó thử auto ID thật
nên sequence tăng dù fixture được rollback/dọn sạch; không reset sequence.

Xem [báo cáo BE02.4](../docs/database-migration-preparation.md) và
[hướng dẫn migration, rollback và triển khai có phê duyệt](../database/migrations/README.md).
Final review giữ Next.js Writer là luồng chính, thêm retry giới hạn cho từng câu
ghi 40P01 và thử helper với deadlock thật. Xem
[kết quả review](../docs/backend-predeployment-review.md) và
[runbook triển khai](../docs/supabase-deployment-runbook.md). Test Local không thay
kiểm thử PostgreSQL 17, quyền Supabase hoặc PostgREST.

Ngày 27/11/2026, migration Production BE02.4 đã COMMIT sau phê duyệt; hậu kiểm
SQL và PostgREST PASS, schema chuyển tiếp 21 bảng. Xem
[biên bản nghiệm thu Production](../docs/be02-4-production-acceptance.md).
Chưa đủ bằng chứng về deployment Vercel Production chứa bản sửa retry Writer
để Resume. Tại mốc BE02.4, runtime Express vẫn giữ gate Local; phần tích hợp
Supabase của BE02.5 được ghi nhận riêng bên dưới. Chưa chuyển API nghiệp vụ.

## Tài liệu tham khảo

BE02.5 đã nghiệm thu: profile Supabase kiểm tra TLS, identity, quyền và đủ 21
bảng trước khi giao từng kết nối mới cho Prisma; dùng Client chuyển tiếp hiện
có. Role novely_backend chỉ có SELECT genres trong phạm vi dữ liệu ứng dụng,
không BYPASSRLS hoặc quyền quản trị. Policy SELECT riêng cho role này giữ RLS
bật và cho Prisma thấy đúng 24 thể loại. HTTP health/ready production trả 200
qua tiến trình Express kiểm tra, không phải deployment Vercel. Hai profile Local
vẫn PASS. Credential runtime nằm ngoài Git tại
`C:\Novely_Backups\novely-backend-runtime.env`, không thay backend/.env Local.
Xem [cấu hình và nghiệm thu BE02.5](../docs/be02-5-supabase-integration.md).

- [Express 5 — Error handling](https://expressjs.com/en/5x/guide/error-handling/)
- [Express — CORS middleware](https://expressjs.com/en/resources/middleware/cors/)
- [Node.js — process.loadEnvFile](https://nodejs.org/docs/latest-v24.x/api/process.html#processloadenvfilepath)

