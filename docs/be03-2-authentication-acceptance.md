# BE03.2 — Authentication: nghiệm thu kỹ thuật Local

Ngày 27/11/2026, branch `feature/auth-user`, triển khai theo
[hợp đồng BE03.1](be03-1-auth-user-contract.md). Không commit/push.

## Kết quả

Đã triển khai bốn endpoint `/api/v1/auth/register`, `/login`, `/logout`, `/me`.
Register 201, login/logout/me 200; DTO và envelope đúng hợp đồng.
Logic port từ `src/app/auth/actions.js`, `src/server/auth/{token,password,session,dal}.js`;
không import code Next trong runtime backend và không sửa bất kỳ file Next nào.

- Giữ bcrypt cost 10, dummy compare, tương thích hash `$2a$10$`, email lowercase,
  username giữ case, validation/thông báo tiếng Việt và JSON boolean theo hợp đồng.
- Giữ HS256, sub string ID, role/iat/exp, TTL 86400/2592000 giây, không thêm iss/aud.
  Xác minh thêm claim bắt buộc và ID integer PostgreSQL hợp lệ; cookie sai/hết hạn trả null.
- Cookie `novely_session`: HttpOnly, Lax, Path=/, Secure ở production, không Domain.
  Logout xóa đúng scope, không cần session hợp lệ. Không trả token trong JSON.
- POST yêu cầu Origin trong allowlist; thiếu/null/sai đều 403. CORS credentials giữ nguyên.
  Caller BFF sau này phải chuyển Origin đã kiểm tra; không cho thiếu Origin để bỏ qua CSRF.
- SessionUser whitelist đúng năm trường, no-store. Đọc lại DB mỗi lần me; role trong
  token/body không cấp quyền. User bị xóa mất phiên; đổi role/avatar có hiệu lực ngay.
- Register chỉ ghi username/email/passwordHash, dùng role default reader; tạo users và
  profiles trong cùng Prisma transaction. Hash ngoài transaction, ký trước commit,
  gửi cookie sau khi transaction thành công. Lỗi profile/ký/commit không gửi cookie.
- Lỗi unique dựa structured metadata/constraint whitelist, không parse SQL message.
  DB outage trả 503; me không biến lỗi DB thành user=null. Không log request/secret/hash.
- Backend khai báo trực tiếp bcryptjs 3.0.3, jose 6.2.18, Zod 4.6.5 trong dependencies
  và lockfile; đã kiểm tra cả ba resolve trong `backend/node_modules`, không nhờ root.

## Kiểm thử

Lệnh: `npm.cmd run test:auth --prefix backend`.
Kết quả: **PASS 20/20, FAIL 0**, gồm hai bài tổng và 18 trường hợp con.
Chỉ chạy bộ Auth mới; không chạy lại các bài nghiệm thu Foundation.

| Nhóm | Bằng chứng |
| --- | --- |
| JWT Next ↔ Express | Token do module Next hiện có ký được Express xác minh và ngược lại; TTL, exp milliseconds |
| JWT xấu | Hết hạn, giả chữ ký, sai secret/algorithm, thiếu claim, ID/iat sai bị từ chối |
| Password cũ | Dùng code password Next hiện có (bỏ marker server-only riêng trong test), hash $2a$ cost10 và verify hai chiều |
| Register | Normalize, DTO, default reader; body role/ID/hash không ảnh hưởng; user/profile cùng tồn tại |
| Duplicate/race | Email/username trả đúng message/code; hai đăng ký đồng thời chỉ một thành công |
| Atomic rollback | Cố tình vi phạm PK profile trong transaction Prisma thật sau khi cả hai INSERT đã chạy; user bị rollback, không Set-Cookie |
| Validation | FirstIssue, kiểu JSON, username/email/password/confirmation/terms sai |
| Login | Username case-sensitive/email lowercase, mật khẩu sai/user thiếu cùng message, TTL 1/30 ngày |
| Quyền/session | Claim admin không vượt DB reader, role/avatar đổi được đọc lại, user xóa trả null |
| Cookie/CSRF | Flags, expiry, clear scope, missing/malicious Origin, CORS preflight, cookie malformed/duplicate |
| Lỗi vận hành | DB outage 503, thông báo an toàn; secret thiếu không tạo user; anonymous/invalid JWT không truy vấn DB |
| Bcrypt 72 byte | Mật khẩu UTF-8 dài vẫn đăng ký/login như source; chứng minh suffix sau 72 byte không ảnh hưởng verify |

Đích duy nhất: `127.0.0.1:5432/novely_restore_test`, được guard và xác minh trước ghi.
Dùng Prisma schema transition 21 bảng hiện có, không sửa schema. Mọi user/profile
fixture đều synthetic với prefix ngẫu nhiên; cleanup kiểm tra không còn fixture.
Sequence Local có thể tăng, không reset sequence/database. Không đọc/ghi Production.

Node phát cảnh báo MODULE_TYPELESS_PACKAGE_JSON khi test import module token Next
thuần JS; không ảnh hưởng kết quả. Không sửa package root chỉ để loại cảnh báo này.

## Giới hạn và việc cần review riêng

1. **Bcrypt chỉ dùng 72 byte đầu**, trong khi validation hiện chấp nhận tới 200 ký tự.
   Hai mật khẩu khác suffix có thể cùng khớp; UTF-8 nhiều byte chạm ngưỡng sớm hơn.
   Đã báo trước khi triển khai, giữ validation/hash để không làm mất đăng nhập cũ.
   Chưa áp dụng giới hạn byte, pre-hash hoặc thuật toán khác.
2. Tương thích protocol/hash/DTO đã PASS với module Next thực tế. Chưa chuyển UI/
   Server Actions sang Express, chưa nghiệm thu browser cutover. Cần phê duyệt riêng
   các adapter Frontend đã liệt kê trong BE03.1; lượt này không sửa `src/` root.
3. Profile Supabase vẫn admission Foundation chỉ đọc genres. Quyền/RLS/Auth write mode,
   secret dùng chung và deploy production chưa triển khai, cần review riêng.
4. Logout vẫn stateless như source: cookie bị xóa nhưng bản sao JWT chưa hết hạn
   không bị thu hồi. Không thêm refresh/revocation hay endpoint ngoài phạm vi.
5. Không thay Production database/runtime role, Vercel (verification vẫn pending),
   không triển khai BE03.3, không chạy migration/reset hoặc tạo PR.

## Danh sách file thay đổi

- `backend/src/modules/auth/auth.routes.js`
- `backend/src/modules/auth/auth.service.js`
- `backend/src/modules/auth/auth.repository.js`
- `backend/src/modules/auth/validation.js`
- `backend/src/modules/auth/token.js`
- `backend/src/modules/auth/password.js`
- `backend/src/app.js`
- `backend/src/routes.js`
- `backend/src/config/env.js`
- `backend/src/middlewares/error-handler.js`
- `backend/package.json`
- `backend/package-lock.json`
- `backend/.env.example`
- `backend/auth-tests/auth.test.js`
- `backend/README.md`
- `docs/be03-2-authentication-acceptance.md`

Cache Microsoft untracked có sẵn được giữ nguyên, không thuộc task.
