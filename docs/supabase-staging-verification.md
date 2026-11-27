# BE02.4 — Nghiệm thu Supabase Staging

## Kết quả cuối ngày 27/11/2026

**BE02.4 Staging: PASS đầy đủ.** Đã đọc toàn bộ sáu log cuối trong
`backend/.local/staging/`, gồm HTTP authenticated. Kết luận áp dụng cho
novely-staging, PostgreSQL 17.12; chưa triển khai production. Lượt tổng hợp này
chỉ đọc file Local và cập nhật tài liệu, không kết nối cloud.

| Bước | Kết quả | Bằng chứng trong log |
| --- | --- | --- |
| Prepare | PASS | 16 bảng, 6 function, 8 trigger; tableData=false |
| Preflight | PASS | Session Pooler 5432; TLS authorized=true; database/role postgres; versionNumber=170012; businessSchemaEmpty=true |
| Init | PASS | 16 bảng legacy; syntheticOnly=true |
| Dry-run | PASS | 21 bảng; dataPreserved=true; permissions=true; rollback=true; applied=false |
| Apply | PASS | 21 bảng; dataPreserved=true; permissions=true; applied=true |
| Smoke | PASS | sdk, reader, writer, sync, forumDenied, rls, cleanup=true; authenticatedHttp=PASS |

Log tương ứng: prepare.result.json, preflight.result.json, init.result.json,
dry-run.result.json, apply.result.json, smoke.result.json. Log và receipt giữ
ở vùng Local được Git ignore; chỉ commit bản tổng hợp không chứa bí mật này.

Runner hậu kiểm trước Apply COMMIT yêu cầu 21 bảng, 70 index, 14 trigger,
7 hàm trả về trigger và 11 đối tượng mới có ACL owner-only. Function hạ tầng
rls_auto_enable() trả về event_trigger được tính riêng. Đây là schema chuyển
tiếp 16 bảng legacy + 5 Forum, giữ chapter_contents và chapter_likes;
không nhầm với schema mục tiêu 19 bảng.

Smoke dùng SDK thật và service Writer hiện có: tạo/sửa/xóa chương, đồng bộ nội
dung hai chiều, truy vấn quan hệ Reader, kiểm tra từ chối quyền Forum qua HTTP
với anon/service_role/authenticated và RLS qua SQL SET LOCAL ROLE. Fingerprint
legacy khớp sau cleanup; rows/grants tạm của kiểm tra RLS đã rollback.
Fixture giả ban đầu và tài khoản Auth thử nghiệm vẫn phục vụ staging;
cleanup=true chỉ xác nhận dữ liệu tạm của Smoke. Khoảng trống sequence do
IDENTITY là bình thường, không reset sequence. Đây không phải kiểm thử toàn
bộ giao diện hoặc đăng nhập Novely.

## Các lỗi đã xử lý

- CA Dashboard được cấu hình qua NODE_EXTRA_CA_CERTS; giữ rejectUnauthorized=true.
- Session Pooler dùng postgres.<staging-ref>; current_user PostgreSQL là postgres.
  Vẫn kiểm tra chính xác phiên bản 17.12, project/host/user và deny-list production.
- Cho phép đúng một rls_auto_enable đã review metadata/event binding và SHA-256:
  `325ae266d9b166715ef5230ceaf7ff9d523e483cf5610dfb9779ab3f183f4af9`.
  Init đối chiếu cả hash và ACL. Không xóa function hoặc tắt RLS. Tham khảo
  [Supabase event triggers](https://supabase.com/docs/guides/database/postgres/event-triggers).
- Smoke từng báo ERR_ASSERTION tại identity-metadata do xác nhận hành động lặp
  sau khi identity đã đạt. Đã bỏ xác nhận lặp riêng cho Smoke; Init/Dry-run/Apply
  vẫn yêu cầu xác nhận, dùng checkpoint action-approval; SDK dùng smoke-setup.
- Schema trống chỉ được yêu cầu ở Preflight/Init. Không áp dụng sau migration.
- Tùy chọn -SignIn dùng SDK đã cài lấy JWT trong bộ nhớ từ tài khoản Auth staging;
  không thêm package, API nghiệp vụ hoặc cơ chế xác thực mới cho Novely.

## Rà soát trước commit

Ngày 27/11/2026, sáu file staging bên dưới đang untracked, chưa staged.
Đã rà soát runner, PowerShell, hai file test hiện có, fixture SQL và tài liệu.
Không bổ sung test hoặc chỉnh migration trong lượt này.

Quét 308 đường dẫn tracked/untracked không bị ignore cho JWT, Supabase key,
private key, token nhà cung cấp và credential gán trực tiếp: các phát hiện nằm
trong ví dụ kết nối Local/test và mật khẩu cố tình sai của test; không phát hiện
credential thật trong nội dung văn bản đã rà soát. Không mở rộng kết luận sang
toàn bộ lịch sử Git hoặc nội dung nhị phân của asset có sẵn. Fixture SQL chỉ chứa
dữ liệu tự tạo, ID âm, email example.invalid và hash giả. Project ref dùng làm
deny-list không phải credential.

Git ignore đã xác nhận backend/.env và backend/.local/staging/ gồm config,
log, receipt, legacy.raw.sql, legacy.schema.sql. Không có .env thật, dump,
private key hoặc cấu hình staging Local trong danh sách tracked/index.
Microsoft/Windows/PowerShell/ModuleAnalysisCache là file nhị phân untracked ngoài
phạm vi, không đưa vào commit. Không dùng git add . hoặc git add -A.
Khi được yêu cầu commit, chỉ chọn sáu file:

- backend/scripts/staging.mjs
- backend/scripts/staging.ps1
- backend/tests/staging-preflight.test.js
- backend/transition-tests/staging-preparation.test.js
- database/tests/staging-legacy-fixture.sql
- docs/supabase-staging-verification.md

Kiểm tra ở lượt sửa Smoke trước đã PASS: 13/13 test preflight, ESLint runner,
cú pháp JavaScript/PowerShell và JavaScript đăng nhập nhúng. Lượt tổng hợp này
không chạy lại test/cloud phase. Kiểm tra git diff --check và whitespace riêng
cho sáu file untracked vì git diff không bao gồm untracked.

Không còn blocker nghiệm thu Staging. Quyền rộng legacy/default privileges là
rủi ro đã ghi nhận, không sửa trong task này. Không chạy lại Init/Dry-run/Apply
trên staging đã thành công. Triển khai production cần yêu cầu riêng. Chưa stage,
commit/push, chưa bắt đầu BE03. Không sửa Frontend, dependency hoặc migration.

## Vận hành bộ lệnh hiện có

Chạy PowerShell tại `C:\Novely\Novely`, dùng Node 24 và dependencies đã cài.
Đặt CA tin cậy trong cùng Terminal trước khi Node khởi động:

```powershell
$env:NODE_EXTRA_CA_CERTS = 'D:\prod-ca-2021.crt'
# Chỉ chạy lại Smoke nếu cần xác minh thay đổi liên quan:
.\backend\scripts\staging.ps1 -Phase smoke -SignIn
```

Nhập password PostgreSQL, API key staging và email/password tài khoản Supabase
Auth thử nghiệm tại prompt. Script lấy access token qua `signInWithPassword()`
và truyền nội bộ cho Smoke, khôi phục biến môi trường khi kết thúc. Không gửi
credential vào chat, lưu vào Git hoặc thêm vào command line/config.json.
Nếu dùng `-Phase smoke` không có `-SignIn`, nhập JWT tại prompt kín; bỏ trống sẽ
cho PARTIAL với authenticatedHttp=NOT_TESTED_NO_USER_JWT, không phải PASS.

Thứ tự sáu phase cho một staging mới là prepare → preflight → init → dry-run →
apply → smoke. Đây là tài liệu tham chiếu, không phải yêu cầu chạy lại trên
staging đã nghiệm thu. Init/Dry-run/Apply cần nhập đúng `<PHASE> <staging-ref>`.
Apply yêu cầu receipt Dry-run khớp project, SQL, fixture và fingerprint dữ liệu.

Prepare dùng pg_restore `--schema-only --schema=public --no-owner --no-privileges`
từ `C:\Novely_Backups\novely_20261125_204719.dump`, bao gồm pre-data/post-data.
Không xuất TABLE DATA, COPY hoặc sequence setval. Bản SQL làm sạch và config chỉ
nằm trong `backend/.local/staging/`. Init chỉ trên public trống về nghiệp vụ,
khôi phục DDL, cấp quyền legacy/default privileges theo audit và thêm fixture giả
trong một transaction; không khôi phục owner/grants trực tiếp từ dump.
Quyền execute legacy được giới hạn đúng sáu function, giữ ACL function hạ tầng.
Config chứa projectRef/productionProjectRef, host/port/user/database không có
password; reviewedPlatformFunctionHash phải khớp thân function đã review.

Dry-run kiểm tra catalog/fingerprint/sequence rồi rollback; Apply chạy riêng,
hậu kiểm trước COMMIT. Migration vẫn là
`database/migrations/20261125_01_expand_legacy.sql`, không viết lại hoặc đổi quyền
để biến lỗi thành PASS. Forum có RLS, không có policy cho phép đọc; SDK với anon,
service_role và authenticated phải nhận SQLSTATE 42501 ở kiểm tra quyền hiện tại.
