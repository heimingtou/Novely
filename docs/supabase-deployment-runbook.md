# BE02.4 — Quy trình triển khai có phê duyệt

Permission hardening cập nhật: đọc [báo cáo quyền](supabase-permission-hardening.md).
Migration hiện thu hồi ACL ngoài owner trên đúng 5 bảng Forum, 4 sequence và 2
function đồng bộ mới. Không còn giữ nguyên bản SQL d99e41d. Phải dùng bản SQL mới
cho dry-run/staging trước phê duyệt COMMIT; không chạy lại trên restore 21 bảng.

Trạng thái hiện tại: **NOT READY cho COMMIT migration Supabase** cho đến khi
hoàn tất các bước xác minh bên dưới. Task review chỉ thực hiện Local. Không chạy
các lệnh cloud trong tài liệu khi chưa được nhóm cho phép.

Migration `database/migrations/20261125_01_expand_legacy.sql` mở rộng bản
`d99e41d` với hardening 11 đối tượng mới. Không dùng `database/schema.sql`, Prisma db push/reset hoặc seed để
nâng database có dữ liệu. Next.js Writer là luồng ghi chương chính; chưa có API
ghi chương Express. Không cho các script/manual writer khác cùng ghi trực tiếp
`chapters.content` trong giai đoạn chuyển tiếp.

## Điều kiện trước cửa sổ triển khai

1. Review/publish bản sửa retry của Writer theo quy trình nhóm. Kiểm thử nó với
   Supabase client thực tế và PostgREST trên staging PostgreSQL 17.12 trước khi
   nâng database thật. Unit test hiện tại dùng DB giả; workspace đang thiếu
   package `@supabase/supabase-js` dù package.json đã khai báo, nên chưa xác nhận
   build Next.js trong lượt review này. Dùng lockfile hiện có để chuẩn bị môi
   trường CI/deploy, không bổ sung công nghệ hoặc tự nâng dependency.
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
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X --password `
  --host '<HOST_TRUC_TIEP_DA_DUYET>' --port 5432 `
  --username '<ROLE_MIGRATION_DA_DUYET>' --dbname postgres --set ON_ERROR_STOP=1
```

Dùng kết nối trực tiếp hoặc session phù hợp; không sử dụng transaction pooler
cho chuỗi transaction vận hành này. Trong psql, xác nhận lại project theo thông
tin kết nối đã duyệt, sau đó có thể kiểm tra riêng quyền:

```sql
BEGIN READ ONLY;
\i database/checks/supabase-access-audit.sql
ROLLBACK;
```

SQL chỉ xuất metadata/số lượng/checksum; không thêm SELECT nội dung hoặc thông
tin người dùng để chẩn đoán. Giữ các kết quả tổng hợp trước/sau để đối chiếu;
không export bảng hoặc sao chép dữ liệu thật vào Git.

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

\i database/checks/legacy-preflight.sql
\i database/checks/supabase-access-audit.sql
\i database/checks/legacy-data-fingerprint.sql
SELECT sequencename,last_value FROM pg_catalog.pg_sequences
WHERE schemaname='public' ORDER BY sequencename;
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

\i database/checks/migration-postflight.sql
\i database/checks/new-object-permissions.sql
\i database/checks/supabase-access-audit.sql
\i database/checks/legacy-data-fingerprint.sql
SELECT sequencename,last_value FROM pg_catalog.pg_sequences
WHERE schemaname='public' ORDER BY sequencename;

ROLLBACK;
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

## Apply thật và hậu kiểm

Chỉ sau khi dry-run PG17, quyền và smoke staging được duyệt, lặp lại **toàn bộ**
transaction ở trên với preflight/checksum mới. Giữ SAVEPOINT test rồi rollback
fixture; sau khi hậu kiểm đạt, người phụ trách thay ROLLBACK cuối bằng COMMIT.
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
