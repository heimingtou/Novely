# BE02.5 — Supabase Integration

Trạng thái ngày 27/11/2026: **BE02.5 PASS, hoàn tất nghiệm thu Supabase
Integration.** Sau khi người dùng duyệt, đã tạo role novely_backend, cấp đúng
phạm vi đã review và thêm SELECT policy riêng trên genres. Runtime đăng nhập
bằng role này qua TLS đã xác minh; Express health/ready trả 200; Prisma đếm
đúng 24/24 thể loại, không phải 0 do RLS che dữ liệu. Không ghi dữ liệu thử,
migration lại hoặc dùng postgres làm runtime. Xác minh deployment Vercel vẫn
pending ở BE02.4; không thay đổi Frontend/Vercel. Commit/push được phê duyệt
riêng ở lượt chốt Git Backend Foundation sau nghiệm thu kỹ thuật.

## Thiết kế kết nối

Tái sử dụng Express 5, Prisma 7.10.1, adapter-pg và pg 8.23.1 đã cài. Không thêm
dependency, runner, API nghiệp vụ hoặc thay đổi Frontend. Prisma schema và DDL
đã nghiệm thu được giữ nguyên; không introspect đè schema chuyển tiếp.

| DATABASE_PROFILE | Database được phép | Prisma Client | TLS và quyền |
| --- | --- | --- | --- |
| local (mặc định) | 127.0.0.1:5432/novely_reconcile_test | Client baseline 19 bảng | Local, phục vụ development/test hiện có |
| local-transition | 127.0.0.1:5432/novely_restore_test | prisma-transition | Local 21 bảng, giữ Library readingStatus nullable |
| supabase | Host đã duyệt, port 5432, database postgres | prisma-transition | CA/hostname được xác minh, role riêng, Foundation chỉ đọc |

Client chuyển tiếp có 19 model ánh xạ trên schema vật lý 21 bảng. Hai bảng cũ
chapter_contents/chapter_likes tiếp tục tồn tại để Next.js hoạt động, không cần
đổi schema hoặc đưa các bảng legacy đó vào API Foundation. Giới hạn PSL về
SET NULL trên một phần composite FK đã được ghi nhận từ BE02.4; validate vẫn
có cảnh báo này. Không sinh migration từ Prisma schema để sửa cảnh báo.

Profile Supabase yêu cầu SUPABASE_PROJECT_REF, SUPABASE_DB_HOST,
SUPABASE_DB_ROLE và DATABASE_CA_FILE riêng. Session Pooler dùng username
`<role>.<project-ref>`; direct connection dùng `<role>`. Chỉ chấp nhận host
Supabase đã đối chiếu và cổng 5432; không dùng transaction pooler 6543 trong
phạm vi này. Không suy ra host từ cấu hình staging.

Thông tin Production đã được người dùng đối chiếu:

- Host: aws-0-ap-southeast-2.pooler.supabase.com, port 5432.
- Database: postgres; project sctbtzvlzrhrhqveceln.
- CA: D:\prod-ca-2021.crt; giữ xác minh tương đương verify-full phía client.

pg nhận ssl.ca, rejectUnauthorized=true và servername trực tiếp. URL không cho
sslmode/sslrootcert/options ghi đè cấu hình TLS; không đặt
NODE_TLS_REJECT_UNAUTHORIZED=0. Xem [hướng dẫn node-postgres](https://node-postgres.com/features/ssl).
pg_stat_ssl=false qua Session Pooler không được dùng thay cho kiểm tra TLS
client; không thay SSL Enforcement của production.

Pool giới hạn năm kết nối, UTC và timeout hiện có. Supabase đặt
default_transaction_read_only=on. Hook onConnect được pg-pool hiện cài chờ hoàn
tất trước khi cấp từng kết nối vật lý cho Prisma. Hook kiểm tra TLS đã xác minh,
database/role/project, PG17, schema đủ 21 bảng, quyền SELECT genres, không có
quyền quản trị/BYPASSRLS, membership đặc quyền, sở hữu relation public hoặc
quyền dữ liệu ngoài phạm vi. Kiểm tra bao gồm schema ứng dụng khác và quyền
EXECUTE hàm SECURITY DEFINER có thể truy cập, không chỉ ACL trực tiếp của public.
Kết nối sai điều kiện bị đóng, readiness trả 503.

TLS/kiểm tra admission của kết nối đầu được hoàn tất trong khởi tạo runtime
lười trước khi Prisma bắt đầu deadline của interactive transaction. Lần thử
ban đầu gặp P2028 khi bắt đầu transaction trên kết nối lạnh; đã sửa thứ tự khởi
tạo, giữ nguyên timeout. Trong lúc khởi tạo, readiness vẫn có thể trả 503 đúng
thiết kế; không báo Ready trước khi database sẵn sàng.

Liveness vẫn không phụ thuộc database. Readiness giữ transaction READ ONLY,
SELECT 1 và deadline hiện có; không nới timeout hoặc trả thông tin credential.

## Cấu hình và generate

backend/.env tiếp tục giữ cấu hình Local. `.env.example` có các biến của từng
profile, chỉ chứa placeholder. Runtime Production dùng một file env ngoài Git
riêng, nạp bằng Node --env-file khi được duyệt; không ghi đè file Local. File
env Supabase hiện có chỉ có URL/API keys/AUTH_SECRET, không thay thế credential
PostgreSQL và không được tự dùng làm DATABASE_URL.

Runtime env cần DATABASE_PROFILE=supabase, DATABASE_URL của novely_backend,
SUPABASE_PROJECT_REF/SUPABASE_DB_HOST/SUPABASE_DB_ROLE và DATABASE_CA_FILE như
bảng trên; các giá trị URL/password chỉ được ghi trong file credential riêng.
Giữ PORT/CORS_ORIGINS phù hợp khi triển khai Express sau này.

File runtime đã cấp: `C:\Novely_Backups\novely-backend-runtime.env`. Mật khẩu
ngẫu nhiên có 256 bit entropy; PostgreSQL lưu SCRAM-SHA-256. File ở ngoài
repository và được khóa ACL, chỉ tài khoản Windows hiện tại/SYSTEM có quyền
truy cập; không sao chép password hoặc URL vào tài liệu/log. File không chứa
API keys Supabase hay credential audit. Giữ backend/.env Local như cũ.

Các lệnh CLI hiện có được tái sử dụng:

```powershell
npm.cmd run db:transition:validate --prefix backend
npm.cmd run db:transition:generate --prefix backend
```

Wrapper db:validate/db:generate cũng chọn schema chuyển tiếp khi profile yêu
cầu. Introspect/format bị chặn ngoài profile Local baseline. Tool restore/migrate
Local và snapshot baseline tiếp tục khóa vào profile baseline Local, không được
dùng để kết nối cloud.
Không dùng db push, migrate/reset, seed hoặc schema.sql trên Production.

## Audit quyền và cấp role đã phê duyệt

Đã đọc PGPASSWORD trực tiếp từ file audit ngoài repository trong một tiến trình
audit riêng, xác minh TLS authorized=true và đúng project/database/role/PG17.12.
Chỉ chạy BEGIN READ ONLY và SELECT metadata role; đóng transaction bằng ROLLBACK.
Không in password, không ghi password/connection URL vào báo cáo; không nạp
credential audit vào môi trường runtime Express.
File `C:\Novely_Backups\production-audit.env` được xóa khi chốt Git vì audit
đã hoàn tất; giữ nguyên `C:\Novely_Backups\novely-backend-runtime.env`.

Audit trước khi thực thi xác nhận novely_backend chưa tồn tại. Role
cli_login_postgres có membership postgres nên không được dùng làm runtime.
Các role nền tảng không phù hợp do LOGIN/quyền quản trị/BYPASSRLS; vì vậy đã tạo
role riêng sau phê duyệt, thay vì dùng tài khoản audit lâu dài.
SQL audit có thể review tại
[backend-runtime-role-audit.sql](../database/checks/backend-runtime-role-audit.sql).
Báo cáo metadata nằm ở backend/.local/production-review/production-runtime-role-audit.result.json.

Phạm vi đã áp dụng trong
[be02_5-runtime-role.sql](../database/proposals/be02_5-runtime-role.sql):

- novely_backend LOGIN, NOINHERIT, không SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS, tối đa năm kết nối.
- CONNECT database postgres, USAGE public, SELECT đúng bảng genres.
- Mặc định transaction chỉ đọc, UTC, search_path pg_catalog/public, timeout 15s.
- Không sở hữu object; không cấp sequence, DML, Forum hoặc membership.
- Không đổi grants/default privileges/policy của Next.js hoặc các role có sẵn.

Audit PUBLIC không có quyền bảng nghiệp vụ, không có hàm SECURITY DEFINER ứng
dụng được PUBLIC EXECUTE. Hai view pg_stat_statements trong extensions có ACL
PUBLIC SELECT nhưng runtime không có USAGE schema đó. Giữ nguyên quyền nền
PUBLIC CONNECT/TEMPORARY và quyền catalog tiêu chuẩn; không REVOKE trên PUBLIC
để tránh đổi hành vi của role khác. Kết luận hạn quyền áp dụng cho dữ liệu ứng
dụng, không tuyên bố mọi quyền nền PostgreSQL đều bị thu hồi.

Role runtime không là thành viên role khác, không có quyền schema/dữ liệu ngoài
phạm vi hoặc quyền dùng hàm SECURITY DEFINER ứng dụng. Không thực thi GRANT ROLE
thủ công. PostgreSQL tự cấp ADMIN OPTION cho người tạo role mới; không cấp
SET/INHERIT trong membership quản trị tự động này. Một lệnh chuẩn bị có thêm
GRANT membership đã bị auto-review chặn trước thực thi; đã loại bỏ hoàn toàn
thao tác đó trước lần cấp role thành công.

genres có RLS=true, force=false và 24 dòng trong audit chủ bảng, nhưng chưa có
policy. Theo phê duyệt bổ sung, chỉ tạo novely_backend_genres_select, PERMISSIVE
FOR SELECT TO novely_backend USING (true). Không bật/tắt RLS hoặc sửa policy
cũ. Kiểm tra bằng login runtime thật và Prisma cho đúng 24 dòng; không chấp nhận
count=0 hoặc dùng BYPASSRLS để làm kết quả đạt.

Foundation hiện chỉ expose health/readiness; SELECT genres đủ cho phép truy vấn
aggregate bằng Prisma thật, không đọc users/profiles hoặc cấp trước quyền cho
BE03. Quyền của module nghiệp vụ sẽ được thiết kế ở task tương ứng.

CREATE ROLE/GRANT/ALTER ROLE và policy đã được COMMIT trong một transaction đã
kiểm tra phạm vi, PUBLIC, membership, catalog, fingerprint và ACL/policy cũ.
Đã tạo verifier SCRAM trong bộ nhớ, không ghi password vào SQL tham chiếu hoặc
log. File SQL tham chiếu vẫn giữ ROLLBACK cuối để tránh chạy nhầm và chặn nếu role
đã tồn tại; không chạy lại trên Production đã nghiệm thu.

Fingerprint 16 bảng, sequence/catalog cũ, grants/policy của Next.js, default ACL,
settings và membership của các role cũ giữ nguyên. Chỉ có grant của role mới và
policy SELECT riêng được bổ sung; không migration lại hoặc ghi dữ liệu nghiệp vụ.

## Kết quả kiểm chứng hiện tại

| Kiểm tra | Kết quả |
| --- | --- |
| Backend unit/security tests | 130/130 PASS |
| Prisma transition validate/generate | PASS; không kết nối Production để generate |
| ESLint các file JavaScript thay đổi | PASS |
| Express Local baseline | health=200, ready=200; aggregate chỉ đọc, schema 19 bảng |
| Express Local chuyển tiếp | health=200, ready=200; Prisma aggregate chỉ đọc, schema 21 bảng; Library nullable giữ nguyên |
| Role/PUBLIC/membership audit Production | PASS trước cấp role; kiểm tra hiệu lực sau cấp role PASS |
| SQL admission | EXPLAIN Local PASS; thực thi trên kết nối runtime Production thật PASS |
| Runtime Production TLS | authorized=true, TLSv1.3, TLS_AES_256_GCM_SHA384; database postgres/current_user novely_backend/PG17.12 |
| health/ready bằng runtime role Production | 200/200, tiến trình Express thật với database Production |
| Prisma read-only aggregate Production | 24 genres = baseline chủ bảng 24; transaction_read_only=on, đủ 21 bảng |
| Dữ liệu và quyền Next.js | Fingerprint/catalog và quyền/policy cũ giữ nguyên |

Không dùng kết quả audit postgres hoặc PostgREST của BE02.4 thay cho runtime.
Hậu kiểm đã dùng credential novely_backend, source Express/Prisma hiện có và
transaction READ ONLY. Server kiểm tra chạy tạm trên loopback với cổng ngẫu
nhiên và đã đóng sau kiểm tra; không tuyên bố đã deploy Express hoặc Resume
Vercel. BE02.5 đã đạt các gate để kết thúc Backend Foundation và bắt đầu BE03
theo yêu cầu riêng; chưa cấp trước quyền nghiệp vụ của BE03.

Artifact Local: backend/.local/supabase-integration/ gồm local.result.json,
public-rls-audit.result.json, runtime-provision.result.json,
production-runtime.result.json và acceptance.result.json. Báo cáo chuẩn bị cũ
được giữ làm lịch sử trước phê duyệt; acceptance.result.json là kết quả cuối.
Không đưa credential, log hoặc artifact vào Git.
Khi chốt Backend Foundation, tách commit BE02.4 và BE02.5, chỉ push nhánh
feature/backend-foundation. Vercel deployment verification vẫn pending, không
Resume hoặc merge main; chưa triển khai BE03.
