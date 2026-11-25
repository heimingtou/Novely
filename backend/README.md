# Novely Backend — BE01 và BE02.2

Express 5 chạy độc lập với Frontend Next.js ở thư mục gốc, theo kiến trúc Layered Modular Monolith. BE02.2 bổ sung Prisma Client cho 19 bảng PostgreSQL Local; chưa chuyển API nghiệp vụ, xác thực hoặc upload từ Next.js sang Express.

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

Chỉ sao chép `.env.example` khi chưa có `backend/.env`; giữ cấu hình riêng đã có. HTTP server và Health API vẫn chạy với giá trị mặc định, không cần tạo `.env`, generate Client hoặc kết nối database. Các lệnh Prisma và kiểm thử tích hợp cần DATABASE_URL hợp lệ như hướng dẫn bên dưới.

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
| `DATABASE_URL` | Không có; ví dụ trong `.env.example` | Chỉ dùng khi truy cập Prisma/CLI hoặc chạy integration test; BE02.2 khóa đích Local `127.0.0.1:5432/novely_reconcile_test`, schema public |

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
│   ├── generated/prisma/      # Client tự generate, gitignore
│   ├── middlewares/
│   │   ├── cors.js
│   │   ├── error-handler.js
│   │   └── not-found.js
│   ├── shared/errors/api-error.js
│   └── modules/
│       ├── health/            # routes → controller → service
│       ├── users/
│       ├── novels/
│       ├── chapters/
│       ├── library/
│       ├── reading/
│       └── forum/
├── integration/prisma.test.js # Chỉ chạy bằng test:db, cần PostgreSQL Local
└── tests/                    # Không cần database
    ├── app.test.js
    ├── env.test.js
    ├── database.test.js
    ├── server.test.js
    └── helpers/http.js
```

Các module nghiệp vụ ngoài Health vẫn là thư mục dành chỗ. Luồng khi triển khai sau này: `routes → controller → service → repository → Prisma → PostgreSQL`. Health chưa cần repository vì không đọc database. Các module cùng chạy trong một ứng dụng Express.

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
có ghi lại file schema.prisma, cần xem Git diff sau đó. Không có script migrate,
db push, reset hoặc seed trong Backend này.

Repository tương lai lấy Client bằng `const prisma = await getPrisma()` từ
`src/database/prisma.js`. Các lời gọi đồng thời trong một tiến trình chia sẻ một
Client và một pool, tối đa 5 connection. Không khởi tạo Client hoặc disconnect sau
mỗi request. Khi tắt server, HTTP đóng trước, sau đó `$disconnect()` và `pool.end()`;
script độc lập phải gọi `disconnectDatabase()` trong finally.

Pool có connection timeout 5 giây, idle timeout 10 giây và statement timeout
15 giây. Các session của pool dùng UTC để xử lý đúng timestamptz với adapter
Prisma 7; không thay cấu hình PostgreSQL toàn cục. Xem [báo cáo và các giới hạn ánh xạ](prisma/README.md)
trước khi viết bất kỳ migration hoặc API nghiệp vụ nào.

## Kiểm thử

```powershell
npm.cmd test --prefix backend
```

Dùng `node:test`, `assert` và HTTP server thật ở cổng ngẫu nhiên; `npm test` không cần Supabase, credential, test database hay cổng 4000 còn trống. Hiện có **60 tests**: 42 test BE01 và 18 test mới về cấu hình/khoanh vùng database, giữ kín secret và khởi tạo trễ. Integration test được tách riêng trong `integration/`, chỉ chạy qua `npm run test:db`.

`test:db` kiểm tra kết nối thật, đọc 19 model, 30 relation, 12 composite key,
kiểu dữ liệu, timezone, pool/shutdown và catalog trước/sau. Phần đọc nghiệp vụ
chạy trong transaction READ ONLY; không tạo fixture. Database Local rỗng nên đây
là kiểm thử truy vấn và ánh xạ, chưa phải kiểm thử CRUD nghiệp vụ có dữ liệu.

Để chạy bộ model test Frontend hiện có, dùng `npm.cmd test` từ root.

## Tài liệu tham khảo

- [Express 5 — Error handling](https://expressjs.com/en/5x/guide/error-handling/)
- [Express — CORS middleware](https://expressjs.com/en/resources/middleware/cors/)
- [Node.js — process.loadEnvFile](https://nodejs.org/docs/latest-v24.x/api/process.html#processloadenvfilepath)

