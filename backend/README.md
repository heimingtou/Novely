# Novely Backend — BE01

Express 5 chạy độc lập với Frontend Next.js ở thư mục gốc. Đây là Backend Foundation theo kiến trúc Layered Modular Monolith; BE01 chưa chuyển nghiệp vụ, xác thực, upload hoặc truy vấn database sang Express.

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

Chỉ sao chép `.env.example` khi chưa có `backend/.env`; giữ cấu hình riêng đã có. Không cần cấu hình hoặc kết nối Supabase cho BE01. Có thể chạy ngay với giá trị mặc định mà không tạo `.env`.

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
├── prisma/                    # Dành chỗ, chưa có schema/migration
├── src/
│   ├── app.js                 # Cấu hình Express, không mở cổng
│   ├── server.js              # Nạp môi trường, mở cổng, tắt server
│   ├── routes.js              # Router /api/v1
│   ├── config/env.js
│   ├── database/              # Dành chỗ cho Prisma client
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
└── tests/
    ├── app.test.js
    ├── env.test.js
    ├── server.test.js
    └── helpers/http.js
```

Các thư mục dành chỗ chứa `.gitkeep`, chưa có implementation. Module nghiệp vụ sau này đi theo `routes → controller → service → repository → Prisma → PostgreSQL`. Health chưa cần repository vì không đọc database. Các module cùng chạy trong một ứng dụng Express.

Giữ Supabase làm nền tảng PostgreSQL và lưu ảnh. Chưa cài Prisma client, tạo schema, chạy seed/migration hoặc thay đổi database trong BE01. Logic `jose`, `bcryptjs`, Zod, dịch vụ và Storage trong `src/` của Next.js được giữ nguyên để tái sử dụng ở task tương ứng. Khi chuyển module, cần thay các phụ thuộc Next.js như `next/headers`, `next/cache`, `server-only` và alias `@/` bằng adapter phù hợp; không import trực tiếp chúng vào Express.

## Kiểm thử

```powershell
npm.cmd test --prefix backend
```

Dùng `node:test`, `assert` và HTTP server thật ở cổng ngẫu nhiên; không cần Supabase, credential, test database hay cổng 4000 còn trống. Kiểm tra health, CORS/preflight, 404, JSON sai/quá lớn, lỗi async, cấu hình môi trường, cổng bị chiếm và vòng đời server. Server được đóng sau kiểm thử.

Để chạy bộ model test Frontend hiện có, dùng `npm.cmd test` từ root.

## Tài liệu tham khảo

- [Express 5 — Error handling](https://expressjs.com/en/5x/guide/error-handling/)
- [Express — CORS middleware](https://expressjs.com/en/resources/middleware/cors/)
- [Node.js — process.loadEnvFile](https://nodejs.org/docs/latest-v24.x/api/process.html#processloadenvfilepath)

