# BE02.4 — Quy trình triển khai có phê duyệt

Permission hardening cập nhật: đọc [báo cáo quyền](supabase-permission-hardening.md).
Migration hiện thu hồi ACL ngoài owner trên đúng 5 bảng Forum, 4 sequence và 2
function đồng bộ mới. Không còn giữ nguyên bản SQL d99e41d. Phải dùng bản SQL mới
cho dry-run/staging trước phê duyệt COMMIT; không chạy lại trên restore 21 bảng.

Trạng thái ngày 27/11/2026: **Production BE02.4 đã COMMIT sau xác nhận riêng của
người dùng cho project sctbtzvlzrhrhqveceln; hậu kiểm SQL và PostgREST PASS.**
Staging, restore backup mới, dry-run Local và dry-run production rollback đều
đã PASS trước Apply. Không dùng staging runner để kết nối production.

Kết quả Apply: 21 bảng, 70 index, 14 trigger, 7 hàm trigger; fingerprint 16 bảng
và sáu sequence cũ giữ nguyên. Catalog sau COMMIT khớp trước COMMIT; 11 đối tượng
mới owner-only, năm bảng Forum rỗng/RLS=true/policy=0. `missing_statistics=1`
giữ nguyên. Bảy truy vấn HEAD Reader/Writer trả 200; mười truy vấn Forum limit=0
của anon/service_role bị từ chối 42501 đúng thiết kế. Quyền authenticated đã
kiểm tra bằng SQL; không chạy HTTP authenticated do không có user JWT.
Báo cáo và hash bằng chứng chỉ lưu trong vùng Git ignore:
`backend/.local/production-review/production-apply.result.json` và
`backend/.local/production-review/production-postgrest.result.json`.
Vercel vẫn giữ Pause; xác nhận bản ứng dụng tương thích đã deploy trước Resume.
Xem [biên bản nghiệm thu Production](be02-4-production-acceptance.md) để biết
bằng chứng đã kiểm tra, gate Vercel còn thiếu và phạm vi commit tài liệu.

## Bằng chứng backup mới và phục hồi Local

- Backup: `C:\Novely_Backups\novely_production_20261127_113703.dump`, 436145 byte.
- SHA-256: `f951791d29b1b12a11e0d02a3de23eb2eae9c19aaa7470f36a5c175297ae74c7`.
- Archive CUSTOM, nguồn PostgreSQL 17.12, công cụ pg_dump 18.3.
- Database phục hồi mới: `127.0.0.1:5432/novely_production_restore_20261127_113703`.
  Không reset hoặc sửa các database thử nghiệm cũ.
- Restore trong một transaction: pre-data → data → post-data, bỏ owner/grants.
  Không tạo FK trước khi nạp data. Lần thử thứ tự không đúng đã rollback toàn bộ.
- Dry-run dùng migration và compatibility SQL hiện có: 21 bảng, 70 index,
  14 trigger, 7 hàm trigger; 11 đối tượng mới owner-only trên Local.
  Fingerprint/số dòng 16 bảng và trạng thái sequence cũ giữ nguyên;
  catalog và fingerprint trở về baseline sau rollback.
- `missing_statistics=1` là dữ liệu cũ, giữ nguyên; không ép mọi chỉ số hậu kiểm
  về 0. Các mismatch nội dung, backfill và parent sai chương đều bằng 0.
- Báo cáo tổng hợp và SQL chứa dữ liệu phục hồi chỉ ở vùng được Git ignore:
  `backend/.local/production-review/restore.result.json` và
  `backend/.local/production-review/local-dry-run.result.json`.
  Không đưa SQL data, backup hoặc credential vào Git.

Local chỉ chứng minh backup phục hồi được và migration tương thích dữ liệu;
không chứng minh quyền/owner/default privileges hoặc phiên bản PG17 production.
Staging đã PASS SDK thật, Reader/Writer, sync, Forum/RLS và HTTP authenticated.

Migration `database/migrations/20261125_01_expand_legacy.sql` mở rộng bản
`d99e41d` với hardening 11 đối tượng mới. Không dùng `database/schema.sql`, Prisma db push/reset hoặc seed để
nâng database có dữ liệu. Next.js Writer là luồng ghi chương chính; chưa có API
ghi chương Express. Không cho các script/manual writer khác cùng ghi trực tiếp
`chapters.content` trong giai đoạn chuyển tiếp.

## Điều kiện trước cửa sổ triển khai

1. Bản sửa retry Writer, SDK thật và PostgREST đã kiểm chứng trên staging
   PostgreSQL 17.12; production build đã PASS ở task trước. Xác nhận bản ứng dụng
   tương thích được triển khai theo quy trình nhóm trước khi mở Writer trở lại.
   Không bổ sung công nghệ hoặc tự nâng dependency.
2. Chốt đúng project/host/database/role triển khai, backup mới ngoài repository,
   bằng chứng restore, người quyết định COMMIT và người chịu trách nhiệm rollback.
   Restore Local trước đó đã bỏ owner/grants, không đại diện quyền Supabase.
3. Kiểm tra phiên bản PostgreSQL 17.12 và phiên bản PostgREST thực tế trên staging;
   xác minh extension, collation, default privileges, giới hạn timeout và thời
   gian khóa. Không tự tăng timeout để bỏ qua thất bại.
4. Đọc kết quả `supabase-access-audit.sql` bằng role triển khai thực tế. Nếu thiếu
   quyền DML của role ứng dụng, có policy Forum ngoài dự kiến hoặc anon/authenticated
   có quyền ngoài thiết kế, dừng để review. Không chạy GRANT/REVOKE hàng loạt.
5. Tạm ngừng toàn bộ writer, seed/job/manual SQL và chờ request đang ghi hoàn tất.
   Writer cũ tạo chương hai bước nên phải bảo đảm không còn chương thiếu hàng
   `chapter_contents`. Khóa migration cũng chặn reader; cần trang bảo trì.

### Xác nhận ngừng ghi khi ứng dụng đã lên Vercel

Không suy luận production đã ngừng ghi chỉ vì Local không chạy. Source có ghi
qua `src/app/Writer/actions.js`, `src/app/auth/actions.js` (đăng ký),
`src/app/users/actions.js` (hồ sơ/follow) và service Writer. Proxy hiện chỉ bảo vệ
đăng nhập `/Writer`, không có maintenance mode. Supabase SDK dùng HTTP nên các
session DB thường thể hiện PostgREST, không nhất thiết mang tên Vercel.

Quan sát `pg_stat_activity`, khóa public và prepared transactions bằng truy vấn
chỉ đọc, không SELECT cột query hoặc nội dung người dùng. Chụp lại ở các lần
transaction khác nhau. `active` không đồng nghĩa đang ghi; `idle` của pool là
bình thường. `idle in transaction`, transaction lâu hoặc khóa chưa được cấp cần
review. Không có transaction ở một thời điểm không chứng minh sẽ không có ghi
mới. Metadata bị ẩn do quyền hoặc track_activities=off không được coi là yên tĩnh.

Trước cửa sổ migration, người quản trị tạm pause đúng Vercel project bằng cơ chế
[Pause Project chính thức](https://vercel.com/docs/projects/managing-projects#pausing-a-project).
Pause này chặn production deployment, có thể làm cả Reader tạm ngừng; không
pause Supabase. Xác minh custom domain và URL deployment production đều bị chặn.
Rà soát riêng preview deployment dùng chung database, Edge Functions, cron,
webhook và script ngoài Vercel; không giả định Pause production chặn chúng.
Không chỉ đóng trình duyệt hoặc chặn riêng trang `/Writer`.

Chờ request đang chạy hoàn tất rồi quan sát DB lại. Không tự gọi
pg_terminate_backend/pg_cancel_backend, đổi ACL legacy, xoay key hoặc đặt database
read-only để thay cho bảo trì. Nếu còn request/transaction không giải thích được,
chưa chạy dry-run. Không chỉ dùng khóa migration để ngăn Writer nhiều bước ghi
tiếp sau khi nhả khóa. Chỉ resume sau hậu kiểm hoặc sau khi hủy cửa sổ migration.

## SQL kiểm tra chỉ đọc

Bốn file trong `database/checks/` chỉ chứa SELECT/CTE, đã chạy thành công trong
transaction READ ONLY trên Local 18.3:

| File | Mục đích |
| --- | --- |
| `supabase-access-audit.sql` | Role, quyền schema/bảng/cột/sequence/function, owner/RLS/policy Forum, default ACL, FK comments |
| `legacy-preflight.sql` | Trạng thái 16 bảng, PG17, scoped timestamp trigger, thiếu nội dung, parent sai chương, số function/index/trigger |
| `legacy-data-fingerprint.sql` | 16 số dòng và checksum tổng hợp, bỏ đúng các cột BE02.4 mới thêm |
| `migration-postflight.sql` | Sau DDL: catalog, nội dung, backfill, Forum rỗng; không dùng trước DDL |

Không có role Supabase trên Local; audit trả `present=false`, không tự tạo role.
Local đã có 21 bảng nên preflight đúng là trả các gate legacy=false. Đây không
phải bằng chứng preflight Supabase đã đạt.

Chỉ mở kết nối sau phê duyệt. Chạy từ root repository; nhập mật khẩu tại prompt,
không đưa URL, token hoặc mật khẩu vào lệnh/chat. Ví dụ placeholder:

```powershell
$productionPoolerHost = Read-Host 'Production Session Pooler hostname (Dashboard Connect)'
$productionConn = "host=$productionPoolerHost port=5432 dbname=postgres user=postgres.sctbtzvlzrhrhqveceln sslmode=verify-full sslrootcert=D:/prod-ca-2021.crt application_name=novely-production-review"
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X --password `
  --dbname $productionConn --set ON_ERROR_STOP=1
```

Dùng Session Pooler hostname đã đối chiếu Dashboard production, port 5432;
không lấy hostname staging theo suy đoán. Nhập password DB tại prompt kín.
CA phải là CA tin cậy của production, có thể tái sử dụng file CA Dashboard đã
xác minh nếu đúng chuỗi chứng chỉ. NODE_EXTRA_CA_CERTS chỉ dành cho Node;
psql/libpq dùng sslmode=verify-full và sslrootcert như trên, không giảm TLS.
Không sử dụng transaction pooler
cho chuỗi transaction vận hành này. Trong psql, xác nhận lại project theo thông
tin kết nối đã duyệt, sau đó có thể kiểm tra riêng quyền:

```sql
\conninfo
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_user AS migration_role,
  current_setting('server_version_num') AS version_number,
  current_setting('supabase.project_ref',true) AS reported_project_ref;
SELECT ssl,version,cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid();
\i database/checks/legacy-preflight.sql
\i database/checks/supabase-access-audit.sql
ROLLBACK;
```

SQL chỉ xuất metadata/số lượng/checksum; không thêm SELECT nội dung hoặc thông
tin người dùng để chẩn đoán. Giữ các kết quả tổng hợp trước/sau để đối chiếu;
không export bảng hoặc sao chép dữ liệu thật vào Git.

Ở lần production này, trước block READ ONLY trên dùng
`\o backend/.local/production-review/production-preflight.log`, sau block dùng
`\o` để trở lại Terminal. Phải database/current_user=postgres,
version_number=170012; reported_project_ref nếu có phải đúng
sctbtzvlzrhrhqveceln. Gate TLS phân biệt hai chặng:

- **Client → Session Pooler:** lệnh mở kết nối phải giữ `sslmode=verify-full`
  và CA tin cậy đã duyệt. `\conninfo` phải xác nhận SSL Connection=true, có
  protocol/cipher TLS, đúng hostname production đã đối chiếu, port 5432 và
  Client User=postgres.sctbtzvlzrhrhqveceln. Chỉ riêng `\conninfo` không chứng
  minh chế độ verify-full; phải đối chiếu cả cấu hình mở kết nối.
- **Session Pooler → PostgreSQL:** `pg_stat_ssl` phản ánh kết nối backend này,
  không phản ánh TLS của client tới pooler. Theo [tài liệu Supabase chính thức](https://supabase.com/kb/troubleshooting/pg_stat_ssl-shows-ssl-false-when-connecting-via-the-connection-pooler-59edc3),
  có thể trả ssl=false khi SSL Enforcement chưa bật, dù client dùng verify-full.
  Với đúng Session Pooler và gate client ở trên đạt, ghi nhận ssl=false theo
  đặc điểm này; không dùng nó làm điều kiện dừng độc lập, cũng không coi cả hai
  chặng đều đã mã hóa. Kết nối trực tiếp PostgreSQL vẫn yêu cầu ssl=true.

Không hạ sslmode, bỏ xác minh CA/hostname hoặc tự thay SSL Enforcement production
để làm gate đạt. Thay đổi SSL Enforcement là thay đổi vận hành riêng, có thể
restart database và ngắt kết nối; không thuộc Preflight/Dry-run này.
Dừng để review log trước khi chạy dry-run.

## Dry-run trên staging hoặc cửa sổ cloud được duyệt

Dùng **một transaction rõ ràng**, không chạy từng phần bằng autocommit. Phiên
psql đang bật ON_ERROR_STOP. Nếu bất kỳ lệnh lỗi, thực hiện ROLLBACK và dừng.

```sql
BEGIN;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
LOCK TABLE public.bookshelves, public.chapter_contents, public.chapter_likes,
  public.chapters, public.comments, public.follows, public.genres,
  public.interact_novel, public.interact_novel_day, public.novel_genres,
  public.novel_likes, public.novels, public.profiles, public.reading_progress,
  public.reviews, public.users IN ACCESS EXCLUSIVE MODE;

\o backend/.local/production-review/production-before.log
\i database/checks/legacy-preflight.sql
\i database/checks/supabase-access-audit.sql
\i database/checks/legacy-data-fingerprint.sql
\i backend/scripts/sql/catalog-snapshot.sql
SELECT sequencename,last_value FROM pg_catalog.pg_sequences
WHERE schemaname='public' ORDER BY sequencename;
\o
```

Dừng/ROLLBACK nếu legacy_16_tables, content_not_added hoặc scoped_timestamp_trigger
không true; trên Supabase/staging PG17, is_postgresql_17 cũng phải true. Trigger
chương phải BEFORE ROW UPDATE đúng sáu cột cũ, không WHEN/argument bất thường.
Yêu cầu missing_contents=0, cross_chapter_parents=0, legacy_functions=6; snapshot
đã review có 38 index/8 trigger. Nếu metadata cloud khác, review riêng trước khi
tiếp tục; không chỉ dựa vào tên function/trigger để kết luận giống Local.

Lưu 16 checksum/số dòng và sáu sequence gốc ở trên. Dùng số dòng hiện tại của
cloud, không ép về số snapshot 642/1054 nếu đã có dữ liệu mới. Không tự sửa truyện
thiếu thống kê. Nếu mọi điều kiện đạt mới tiếp tục trong **cùng phiên/transaction**:

```sql
\i database/migrations/20261125_01_expand_legacy.sql

SAVEPOINT compatibility;
\i database/tests/be02_4-compatibility.sql
ROLLBACK TO SAVEPOINT compatibility;
RELEASE SAVEPOINT compatibility;

\o backend/.local/production-review/production-expanded.log
\i database/checks/migration-postflight.sql
\i database/checks/new-object-permissions.sql
\i database/checks/supabase-access-audit.sql
\i database/checks/legacy-data-fingerprint.sql
\i backend/scripts/sql/catalog-snapshot.sql
SELECT sequencename,last_value FROM pg_catalog.pg_sequences
WHERE schemaname='public' ORDER BY sequencename;
\o

ROLLBACK;

\o backend/.local/production-review/production-rollback.log
BEGIN READ ONLY;
SET LOCAL TIME ZONE 'UTC';
\i database/checks/legacy-preflight.sql
\i database/checks/supabase-access-audit.sql
\i database/checks/legacy-data-fingerprint.sql
\i backend/scripts/sql/catalog-snapshot.sql
SELECT sequencename,last_value FROM pg_catalog.pg_sequences
WHERE schemaname='public' ORDER BY sequencename;
ROLLBACK;
\o
```

Trước ROLLBACK cần xác nhận 21 bảng, index/trigger/function phù hợp kế hoạch
(snapshot hiện tại 70/14/7), không index invalid; content/backfill mismatch=0;
Forum rỗng, RLS bật cả năm, không policy ngoài dự kiến. Cả 16 checksum/số dòng
và trạng thái sáu sequence gốc phải khớp trước DDL. SQL compatibility dùng ID âm,
không gọi nextval; bốn sequence Forum mới là đối tượng bổ sung, không so với sáu
sequence cũ.

Sau rollback, chạy lại READ ONLY preflight/fingerprint/sequence để xác nhận trở
về 16 bảng và dấu vân tay trước thử. RLS/grants/default privileges phải được
review theo đúng role tạo đối tượng. Nếu rollback hoặc bất kỳ đối chiếu nào sai,
dừng; không reset database hoặc thử apply tiếp.

Ba file production-before/expanded/rollback.log phục vụ review đối chiếu Local;
không cần copy Terminal dài. Giữ ngừng writer đến khi kiểm tra xong rollback;
nếu có ghi đồng thời sau khi nhả khóa thì fingerprint có thể thay đổi hợp lệ.
Không giữ transaction mở trong lúc chờ phê duyệt qua chat: dry-run phải kết thúc
bằng ROLLBACK. Khi có lỗi, chủ động ROLLBACK và báo mã lỗi, không tiếp tục DDL.

## Apply thật và hậu kiểm

Chỉ sau khi dry-run PG17, quyền và smoke staging được duyệt, lặp lại **toàn bộ**
transaction migration ở trên với preflight/checksum mới. Giữ SAVEPOINT test rồi
rollback fixture. Chỉ sau xác nhận riêng mới thay đúng ROLLBACK kết thúc
transaction migration (ngay sau production-expanded.log) bằng COMMIT; không thay
ROLLBACK của SAVEPOINT hoặc của block READ ONLY. Block production-rollback.log
chỉ dùng cho dry-run; sau Apply dùng hậu kiểm schema đã mở rộng bên dưới.
Không kết hợp BEGIN thủ công với tùy chọn psql --single-transaction. Nếu đóng
gói thành file riêng không chứa BEGIN/COMMIT, mới dùng --single-transaction cùng
ON_ERROR_STOP; phải giữ đủ preflight/hậu kiểm, không chỉ chạy mỗi file DDL.

Sau COMMIT, kiểm tra read-only lại catalog, RLS/quyền và checksum trước khi mở
writer. `NOTIFY pgrst,'reload schema'` chỉ có hiệu lực khi commit; dry-run rollback
không reload. HTTP khác không thấy DDL chưa commit, nên không kiểm tra PostgREST
mới trong khi transaction đang giữ khóa. Smoke HTTP trên staging đã commit,
sau đó trên cloud đã commit bằng HEAD/limit=0, không in dữ liệu:

- Các phép join Reader/Writer đang dùng: chapter_contents, genres/novel_genres,
  interact_novel, profiles, reviews→novels và follows→users!fk_follows_follow.
- Comments truy vấn phẳng comment_id/chapter_id/parent_id. Không mặc định rằng
  self-embed comments hoặc chỉ thêm !constraint sẽ giải quyết mọi nhập nhằng.
- Forum owner-only, không có policy: anon/authenticated/service_role đều phải
  bị từ chối quyền bảng, kể cả service_role có BYPASSRLS. Chỉ owner quản lý đến
  khi API Forum có thiết kế quyền riêng được duyệt. Không thử ghi cloud trong task này.

Ví dụ hình dạng kiểm tra không trả nội dung, chỉ dùng trong môi trường được duyệt:

```javascript
await supabase.from("chapters")
  .select("chapter_id,chapter_contents(chapter_id)", { head: true }).limit(0);
await supabase.from("comments")
  .select("comment_id,chapter_id,parent_id", { head: true }).limit(0);
```

HEAD xác nhận hình dạng truy vấn/quyền, không thay thế thử hành vi RLS/DML với
dữ liệu giả ở staging. Chưa mở giao diện/HTTP ghi chương Express hoặc API Forum.

## Rollback và tiêu chí mở lại writer

Trước commit: ROLLBACK cả transaction nếu bất kỳ gate hoặc hậu kiểm không đạt.
Sau commit: ưu tiên quay lại bản ứng dụng tương thích và giữ schema expand/
trigger, không DROP cột hoặc hai bảng cũ. Nếu bắt buộc restore, dừng ghi, bảo
toàn thay đổi mới và khôi phục backup vào môi trường cô lập được duyệt để đối
chiếu trước khi chuyển kết nối. Không có DOWN tự động làm mất dữ liệu.

Chỉ mở lại Next.js Writer khi quyền thực tế, schema cache/HTTP, content/checksum
và rollback plan đều được xác nhận. Theo dõi SQLSTATE 40P01 ở mức mã lỗi/tần suất,
không log SQL payload/nội dung truyện. Hết hai retry vẫn có thể trả lỗi: không bật
retry toàn bộ Save/Create ở UI, proxy hoặc job để che lỗi này.
