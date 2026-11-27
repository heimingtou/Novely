# BE02.4 — Supabase Permission Hardening

Kết quả: **PASS Local**; chưa phê duyệt COMMIT Supabase. Đã đọc toàn bộ audit
`C:\Novely_Backups\supabase-audit.txt` do nhóm cung cấp, không kết nối cloud.
Audit xác nhận PG17.12, 16 bảng, structural gates đạt, 38 index/8 trigger/6 function;
default ACL của postgres và supabase_admin rộng, có TRUNCATE/MAINTAIN/EXECUTE.

## Quyền mới

Migration chưa triển khai được bổ sung block `NEW OBJECT ACL HARDENING`, chạy
trong cùng transaction sau tạo trigger/index và trước postflight/commit:

| Đối tượng | Quyền giữ lại |
| --- | --- |
| 5 bảng Forum | Chỉ owner; RLS vẫn bật, không thêm policy |
| 4 sequence Forum | Chỉ owner; không USAGE/SELECT/UPDATE cho role ứng dụng |
| 2 function đồng bộ nội dung | Chỉ owner EXECUTE; vẫn SECURITY INVOKER/search_path pg_catalog |

Block tìm đúng 11 object, lấy sequence theo IDENTITY thực tế; thu hồi ACL trực
tiếp của mọi grantee ngoài owner, gồm PUBLIC/anon/authenticated/service_role.
Kiểm tra thêm quyền hiệu lực của ba role ứng dụng để chặn quyền còn sót qua role
membership. Sai số object hoặc còn quyền sẽ gây lỗi và rollback transaction.
Không dùng REVOKE ALL ON ALL TABLES, không CASCADE, không đổi schema grants hoặc
global/default privileges, không đổi quyền của 16 bảng cũ.

Source hiện không có nghiệp vụ Forum phía server, nên service_role cũng chưa
cần quyền Forum. Việc cấp quyền cho API Forum tương lai cần task riêng. Owner
migration vẫn quản lý được object; owner/superuser không thuộc mô hình cấm này.

`src/lib/supabase/admin.js` dùng server secret key; Writer ghi metadata chapters
và INSERT/UPSERT/DELETE chapter_contents. Quyền DML cũ giữ nguyên. Function
trigger tự chạy trong luồng DML với quyền invoker; kiểm thử xác nhận role server
không có EXECUTE trực tiếp vẫn đồng bộ được hai chiều. Quyền tạo trigger của
owner được sử dụng trước khi hardening; không cấp thêm EXECUTE cho PUBLIC.
Xem [PostgreSQL CREATE TRIGGER](https://www.postgresql.org/docs/17/sql-createtrigger.html)
và [REVOKE, quyền cộng gộp qua membership](https://www.postgresql.org/docs/17/sql-revoke.html).

## Kiểm thử Local

`npm.cmd run test:permissions --prefix backend`: **9/9 PASS**, gồm test cha.
Test chỉ kết nối novely_restore_test Local; tạo schema/ba role NOLOGIN tên ngẫu
nhiên trong một transaction, default ACL theo schema cấp ALL cho ba role, role
server có BYPASSRLS và function có PUBLIC EXECUTE mặc định. Không tạo/sửa role
Supabase có thật, không thay default ACL của public/global.

Test lấy trực tiếp phần CREATE Forum, trigger/function và block hardening từ
migration, chỉ đổi schema/tên role cho fixture. Không chạy toàn bộ migration.
Trước hardening xác nhận TRUNCATE/sequence UPDATE/EXECUTE thật sự được cấp;
sau đó kiểm tra cả 11 ACL owner-only, SELECT/INSERT/TRUNCATE/nextval/function
call bị từ chối 42501 cho ba role, RLS năm bảng còn bật. Writer INSERT/UPSERT,
ghi ngược chapters.content và DELETE vẫn đồng bộ đúng với dữ liệu giả.

Cuối transaction rollback; đối chiếu catalog, checksum 16 bảng, grants và toàn
bộ pg_default_acl trước/sau giống nhau; schema/role thử không tồn tại nữa.
Không reset database, không chạy lại migration trên public đã có 21 bảng.
Public restore hiện vẫn là snapshot cũ chưa harden: không áp fragment vào public
chỉ để làm báo cáo quyền ở đó đạt.

Regression: root **60/60 PASS**, Backend **94/94 PASS**. Không đổi source nghiệp
vụ. Script test:transition chạy các file tuần tự để snapshot public/sequence
không bị test khác tác động. Test permissions riêng không gọi nextval trên
sequence thật của public và không để lại fixture.

## Quy trình staging/triển khai

Dùng [runbook hiện có](supabase-deployment-runbook.md), giữ BEGIN, khóa bảng,
preflight/fingerprint, SAVEPOINT compatibility và hậu kiểm. Bổ sung trong cùng
transaction, trước quyết định ROLLBACK hoặc COMMIT:

```sql
\i database/checks/new-object-permissions.sql
\i database/checks/supabase-access-audit.sql
```

Phải có đúng 11 dòng non_owner_grants=0. Audit quyền hiệu lực phải trả false
trên 11 đối tượng mới cho anon/authenticated/service_role; Forum RLS=true và
policy_count=0. Không yêu cầu quyền các bảng cũ trở thành false.

Lệnh mở staging PostgreSQL17, chỉ chạy sau khi nhóm xác nhận host/role:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X --password `
  --host '<STAGING_HOST_DA_DUYET>' --username '<MIGRATION_ROLE>' `
  --dbname postgres --set ON_ERROR_STOP=1
```

Chạy toàn bộ chuỗi runbook với ROLLBACK trước. Khi được duyệt mới lặp lại với
COMMIT. PostgREST chỉ thấy schema mới sau commit/NOTIFY; thử trên staging đã
commit: HEAD/limit=0 vào năm bảng Forum phải bị từ chối quyền kể cả service_role,
không coi BYPASSRLS là thay thế table grants. Reader/Writer cũ phải hoạt động;
trên staging dùng dữ liệu giả thử create/save/delete chương, kiểm tra content
khớp và cleanup. Không tự thêm GRANT hoặc policy để làm smoke Forum trả 200.

Chưa xác minh trên PG17/PostgREST thật: quyền membership hiệu lực, event trigger
của Supabase, metadata/schema-cache và luồng HTTP sau sửa ACL. Local dùng PG18.3;
không giả định kết quả Local thay bằng chứng staging. Structural preflight cloud
đã được nhóm xác nhận, nhưng ACL hậu migration mới vẫn cần dry-run/staging.

## Rủi ro quyền cũ

Audit chỉ rõ anon/authenticated có TRUNCATE trên chapters/chapter_contents.
RLS không chặn TRUNCATE. Task này giữ nguyên các quyền cũ theo yêu cầu, nên rủi
ro đó chưa được xử lý. Dùng `supabase-access-audit.sql` để kiểm tra chỉ đọc quyền
cũ; mở review riêng về ACL, role membership và các đường truy cập trực tiếp.
Không thử TRUNCATE hoặc thao tác phá dữ liệu trên cloud để kiểm chứng.

## File thay đổi

- Migration: thêm block ACL cho đúng 11 object mới.
- `database/checks/new-object-permissions.sql`: audit ACL chỉ đọc mới.
- `database/checks/legacy-preflight.sql`, `migration-postflight.sql`: ghi rõ gate quyền bổ sung.
- `backend/transition-tests/permissions.test.js`: fixture quyền cô lập mới.
- `backend/package.json`: test:permissions và chạy transition tests tuần tự.
- `docs/supabase-deployment-runbook.md`: cập nhật bản migration và hậu kiểm.
- Báo cáo này.

Không thay kiến trúc, không cài package, không sửa UI/Writer hoặc quyền database
thật. Không commit/push.
