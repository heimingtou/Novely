# Backend (Supabase + Route Handlers)

## Cấu hình

1. Sao chép `.env.example` thành `.env` và điền `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY` (Dashboard > Project Settings > API Keys > Secret keys).
2. Nạp dữ liệu mẫu: `python src/lib/seed_novel.py --reset` tạo `seed.sql`, rồi chạy file đó trong
   Supabase Dashboard > SQL Editor (hoặc `psql`). Script yêu cầu database đã có trigger cột đếm.
3. `npm run dev`, mở `http://localhost:3000/api/health` — phải trả `{"status":"ok"}`.

Schema: `database/schema.sql`.

## Cấu trúc

```
src/lib/supabase/
  env.js        đọc & kiểm tra biến môi trường
  admin.js      createAdminClient() — dùng SECRET KEY, bỏ qua RLS; services dùng client này (server-only)
  server.js     createClient() theo cookie người dùng — dành cho đăng nhập sau này (server-only)
  client.js     createClient() cho Client Component
src/server/
  http.js       ok(), fail(), ApiError, withErrorHandling, parsePagination
  services/     tầng truy cập dữ liệu — mọi truy vấn Supabase nằm ở đây
src/app/api/    Route Handlers (chỉ đọc tham số, gọi service, trả JSON)
```

Server Component nên gọi thẳng service (`import { listNovels } from "@/server/services/novels"`)
thay vì fetch `/api/...` của chính mình. API dùng cho Client Component hoặc client bên ngoài.

## Endpoint

| Method | Đường dẫn | Ghi chú |
| --- | --- | --- |
| GET | `/api/health` | kiểm tra kết nối và schema |
| GET | `/api/genres` | danh sách thể loại |
| GET | `/api/novels` | `page`, `limit` (≤100), `status=ongoing\|completed`, `genre` (slug), `q`, `sort=latest\|newest\|popular\|title` |
| GET | `/api/novels/:id` | `novel_id` hoặc slug |
| GET | `/api/novels/:id/chapters` | chương `status='published'`, không kèm nội dung |
| GET | `/api/novels/:id/chapters/:chapterNumber` | `content`, `paragraphs[]` (tách theo dòng trống), `prev_chapter`/`next_chapter` |
| GET | `/api/users/:id` | `user_id` hoặc username — hồ sơ công khai + truyện |

Chỉ trả truyện `published = true`. Phản hồi: `{ data, meta? }` khi thành công, `{ error: { code, message } }` khi lỗi.

## Bảo mật

- Dữ liệu được đọc ở server bằng `SUPABASE_SECRET_KEY` (bỏ qua RLS). Key này **không** có tiền tố
  `NEXT_PUBLIC_`, không được đưa xuống trình duyệt, không commit lên git.
- Vì bỏ qua RLS, mỗi service phải tự chọn cột công khai: không bao giờ `select("*")` trên `users`/`profiles`
  (`password_hash`, `email`, `phone_number`, `birthday`).
- Giữ RLS bật trên Supabase, không tạo policy cho `anon` đọc `users`/`profiles`, để publishable key
  (lộ ra trình duyệt) không đọc được dữ liệu nhạy cảm.
