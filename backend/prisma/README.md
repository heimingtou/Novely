# BE02.2 — Prisma ORM Foundation

Kết luận: PASS trên Local `127.0.0.1:5432/novely_reconcile_test`, PostgreSQL 18.3.
Ngày kiểm thử: 25/11/2026. Branch: `feature/backend-foundation`.

## Phiên bản và phạm vi

| Dependency | Phiên bản cố định | Vai trò |
| --- | --- | --- |
| prisma | 7.10.1 | CLI, devDependency |
| @prisma/client | 7.10.1 | Prisma Client runtime |
| @prisma/adapter-pg | 7.10.1 | Adapter PostgreSQL |
| pg | 8.23.1 | Driver và connection pool |

Workspace thực tế: Node.js 24.18.0, npm 11.16.0. Prisma CLI yêu cầu Node
`^20.19 || ^22.12 || >=24.0`, tương thích Node 24 hiện có. Express/CORS giữ nguyên.
Toàn bộ cài đặt, config và implementation mới nằm trong `backend/`.

Prisma config 7.10.1 kéo `effect@3.20.0`, bị npm audit cảnh báo theo
[GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw).
Đã override riêng `@prisma/config@7.10.1` sang **effect 3.22.5**, cùng major và
cao hơn bản vá 3.22.1. CLI validate/generate và kiểm thử đều đã chạy với override.
Không dùng audit fix --force, không hạ Prisma về 6 hoặc nâng sang 8.

## 19 model và bảng tương ứng

| Prisma model | PostgreSQL table |
| --- | --- |
| User | users |
| Profile | profiles |
| Follow | follows |
| NovelLike | novel_likes |
| Novel | novels |
| Chapter | chapters |
| Genre | genres |
| NovelGenre | novel_genres |
| Bookshelf | bookshelves |
| ReadingProgress | reading_progress |
| Comment | comments |
| Review | reviews |
| InteractNovel | interact_novel |
| InteractNovelDay | interact_novel_day |
| ForumCategory | forum_category |
| ForumPost | forum_post |
| ForumComment | forum_comment |
| ForumReaction | forum_reaction |
| ForumReport | forum_report |

Model dùng PascalCase, field dùng camelCase; `@map` và `@@map` giữ nguyên tên
snake_case trong PostgreSQL. FK, index, PK và UNIQUE giữ tên đã introspect;
không đưa chapter_contents/chapter_likes trở lại schema.

## Cấu trúc Client Foundation

- `prisma.config.mjs`: cấu hình Prisma 7 bằng JavaScript, đọc đúng backend/.env.
- `src/config/database.js`: kiểm tra URL, khóa đích Local/public, giới hạn pool.
- `src/database/prisma.js`: khởi tạo trễ, dùng lại Client/pool trong cùng tiến
  trình, xử lý concurrent accessor và disconnect idempotent.
- `src/generated/prisma/`: generated JavaScript package, không đưa vào Git.
- `src/server.js`: đóng HTTP trước rồi disconnect Client và đóng external pool.
- `scripts/prisma.js`: chỉ expose introspect/validate/generate/format; che URL
  và mật khẩu khi hiển thị output CLI. Không truyền secret qua command arguments.
- `scripts/snapshot-database.js`, `scripts/lib/catalog.js`,
  `scripts/sql/catalog-snapshot.sql`: đối chiếu catalog bằng truy vấn đọc.
- `tests/database.test.js`: kiểm thử không cần credential/database.
- `integration/prisma.test.js`: kiểm thử đọc thật và vòng đời kết nối.

`getPrisma()` trả Promise của Client dùng chung. Module không import generated
Client hoặc mở kết nối tại thời điểm import. Vì vậy Health API và 42 test BE01
không phụ thuộc việc PostgreSQL đang chạy, DATABASE_URL hoặc generation.

Pool: max=5, connectionTimeoutMillis=5000, idleTimeoutMillis=10000,
statement_timeout=15000. Adapter dùng external pg.Pool với
disposeExternalPool=false; disconnect gọi `$disconnect()` rồi `pool.end()` trong
finally. Các phiên được cấu hình `options: '-c timezone=UTC'` tại startup.

## Giới hạn PostgreSQL cần giữ bằng SQL

`database/schema.sql` tại root vẫn là **nguồn DDL đầy đủ**. schema.prisma là
ánh xạ cho Client, không thay thế DDL và chưa phải một baseline migration.

| Tính năng | Ánh xạ/giới hạn và quyết định |
| --- | --- |
| 49 CHECK | Prisma introspection cảnh báo, chưa biểu diễn đầy đủ. Giữ CHECK trong PostgreSQL; status/readingStatus/reactionType vẫn là String, không tự tạo PostgreSQL enum. |
| 11 trigger, 4 hàm trigger | Không có biểu diễn tương đương trong Prisma schema. Database tiếp tục sở hữu timestamp và 3 nhóm counter; không thêm @updatedAt hoặc code tăng counter. |
| Composite FK | Giữ đủ cột và thứ tự: Progress–Chapter, Comment–parent và ForumComment–parent. Không tách thành FK đơn để validation qua. |
| CASCADE / RESTRICT / NO ACTION | Map rõ trong @relation, relationMode=foreignKeys; database thực thi. Giữ 18 Cascade, 2 Restrict và 9 NoAction. |
| SET NULL (chapter_id) | Prisma chỉ có onDelete:SetNull, không có danh sách cột. Giữ novelId bắt buộc và chapterId nullable, để PostgreSQL đặt NULL đúng chapter_id. Không sửa FK/schema thật. |
| IDENTITY ALWAYS | Prisma thể hiện bằng @default(autoincrement()), không phân biệt đầy đủ ALWAYS/BY DEFAULT/serial. Giữ cả 10 cột ALWAYS trong PostgreSQL, không dùng schema này để tái tạo identity một cách mù quáng. |
| Kiểu số | bigint → BigInt/JS bigint; smallint → Int @db.SmallInt; real → Float @db.Real. Real có sai số float32; JSON API sau này phải chuyển BigInt sang chuỗi thích hợp. |
| Ngày giờ | date → DateTime @db.Date; timestamptz → DateTime @db.Timestamptz(6). JS Date chỉ giữ millisecond, không giữ toàn bộ microsecond của PostgreSQL. |

Validation thành công kèm một cảnh báo SetNull do novelId là cột bắt buộc trong
FK composite. Cảnh báo này phản ánh giới hạn PSL, không chứng minh FK PostgreSQL
sai. Không đổi novelId thành nullable, không đổi hành vi xóa hoặc xóa constraint.
Khi viết API sau này cần tránh nested disconnect có ý định đặt NULL toàn bộ FK;
đối chiếu SQL có chọn cột trước mọi migration do Prisma đề xuất.

Kiểm thử thời gian phát hiện lỗi thực tế với adapter 7.10.1: PostgreSQL Local
dùng session TimeZone Asia/Bangkok; TIMESTAMPTZ 08:30Z bị Prisma đọc thành
15:30Z. Phần normalize_timestamptz của adapter thay offset mà không quy đổi đúng
instant, phù hợp với [issue phía Prisma](https://github.com/prisma/orm/issues/28629).
Cấu hình **UTC cho riêng các connection Backend** đã khắc phục ca tái hiện, kể
cả raw Date parameter và ranh giới ngày. Không ALTER DATABASE/SYSTEM hay đổi
timezone hệ thống. Các thống kê theo ngày địa phương phải chọn timezone nghiệp
vụ rõ ràng khi triển khai module; không mặc định CURRENT_DATE theo giờ Việt Nam.

Không dựa vào Prisma Migrate/db push để tái tạo CHECK, trigger, identity hoặc
partial SET NULL. Chưa khảo sát lại quyền app role/RLS trên Supabase; phần này
vẫn cần kiểm thử riêng trước migration cloud theo báo cáo BE02.1.

## Kết quả kiểm thử và bằng chứng bảo toàn

| Kiểm tra | Kết quả |
| --- | --- |
| Kết nối PostgreSQL qua backend/.env, không in URL/mật khẩu | PASS, đúng Local/novely_reconcile_test |
| Introspection | Đủ 19 model |
| Prisma validate | PASS, cảnh báo SetNull có giải thích ở trên |
| Prisma generate | PASS, JavaScript Client 7.10.1 |
| Unit Backend | 60/60: 42 BE01 + 18 test mới, không cần DB |
| Prisma integration | 77/77 (gồm test cha): 19 model, 30 FK relation, 12 compound selector, type/timezone và lifecycle |
| Database BE02.1 chạy lại với reuse_schema=true | 479/479, không nạp lại DDL |
| Sau kiểm thử SQL | 19 bảng, 0 dòng fixture, sequence identity chưa tăng |
| Index/trigger/function sau introspection và các lượt test | 57 / 11 / 4, nguyên định nghĩa |
| npm audit sau override Effect | 0 vulnerabilities |
| git diff --check | PASS |

Baseline được chụp **trước introspection** trong `backend/.local/be02_2-before.json`.
Đối chiếu cả định nghĩa bảng/cột/default/nullability/identity, constraints,
index, trigger, thân hàm, RLS/policies, grants và sequence state, không chỉ đếm
object. Metadata SHA-256 trước/sau:
`8e1c749a7f67d213bd2ef09cf265b28f6d5fcf0d81a7eb7b2ace5e63029ff66e`.

File SQL mục tiêu cũng giữ SHA-256:
`b941d3b3dca623a661c129b8ced8651e76d1c382b149b3725dcfea8212964ae4`.

Prisma integration dùng READ ONLY cho các truy vấn model/relation/key. Database
hiện rỗng nên kiểm thử xác nhận ánh xạ và SQL đọc thực thi được; chưa xác nhận
nghiệp vụ CRUD/nested write bằng Prisma với dữ liệu. BE02.1 kiểm thử ràng buộc và
trigger bằng fixture tổng hợp trong transaction rồi ROLLBACK. Không để lại dữ
liệu hoặc tăng sequence. Log SQL chạy lại: `backend/.local/be02_1-rerun.log`.

## Chạy lại

Từ repository root, giữ nguyên backend/.env đã cấu hình:

```powershell
npm.cmd ci --prefix backend
npm.cmd run db:validate --prefix backend
npm.cmd run db:generate --prefix backend
npm.cmd test --prefix backend
```

Cho một lượt đối chiếu mới trên database Local đã nghiệm thu:

```powershell
npm.cmd run db:snapshot --prefix backend
npm.cmd run test:db --prefix backend
```

Giữ nguyên baseline trong quá trình thay đổi code và chạy test. Nếu muốn
introspect lại, chụp baseline trước rồi `npm.cmd run db:introspect --prefix backend`,
xem diff, validate và generate lại. Không overwrite baseline chỉ để test qua.

Chạy lại BE02.1 bằng Terminal tương tác, nhập mật khẩu trực tiếp tại psql:

```powershell
& .\database\tests\run-be02_1.ps1 -ReuseSchema
npm.cmd run test:db --prefix backend
git diff --check
```

Không dùng migrate dev, migrate reset, db push, DROP, RESET hoặc seed cho task
này. Không đưa thư mục generated/.local hoặc .env vào Git. Khi thiếu config,
kết nối sai hoặc target khác, các lệnh DB dừng; Health API vẫn chỉ kiểm tra HTTP.

## File thay đổi

Đã sửa: backend/package.json, backend/package-lock.json, backend/.env.example,
backend/.gitignore, backend/README.md, backend/src/config/env.js,
backend/src/server.js.

Đã tạo: backend/prisma.config.mjs, backend/prisma/schema.prisma,
backend/prisma/README.md, backend/src/config/database.js,
backend/src/database/prisma.js, backend/scripts/prisma.js,
backend/scripts/snapshot-database.js, backend/scripts/lib/catalog.js,
backend/scripts/sql/catalog-snapshot.sql, backend/tests/database.test.js,
backend/integration/prisma.test.js.

Generated Client và baseline/log chỉ tồn tại Local, đã gitignore. Cache
Microsoft/Windows/PowerShell/ModuleAnalysisCache có từ trước, ngoài phạm vi task.
Git status cuối: 7 file tracked đã sửa, 11 file mới, tất cả thuộc backend/;
cache PowerShell là mục untracked có sẵn. Không stage file hoặc đổi branch.
Frontend/Backend Next.js, Supabase, database/schema.sql và bộ test SQL BE02.1
được giữ nguyên. Không triển khai API nghiệp vụ, migration, commit/push hoặc BE02.3.

## Tham khảo chính thức

- [Prisma config, JavaScript/mjs được hỗ trợ](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)
- [Generator Prisma Client, JavaScript generator và deprecation](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators)
- [Driver adapters trong Prisma 7](https://docs.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers)
- [Mapping tên model và database](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/database-mapping)
- [node-postgres: chuyển đổi kiểu và độ chính xác thời gian](https://node-postgres.com/features/types)
