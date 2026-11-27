# BE02.4 — Final Build Verification

**Kết luận: PASS cho phạm vi kiểm tra build.** Ngày 27/11/2026, branch
`feature/backend-foundation`, HEAD `d99e41d`. Không triển khai hoặc kết nối
Supabase thật, không thực hiện migration, không commit/push.

## Review dependency

Đã đối chiếu package.json, toàn bộ package-lock.json với HEAD và package thực tế
trong node_modules. Hai dependency trực tiếp đổi từ **16.3.8 → 16.4.6**:

- `next`.
- `eslint-config-next`.

Lockfile chỉ đổi 12 package entries thuộc nhóm Next: hai package trên,
`@next/env`, `@next/eslint-plugin-next` và tám binary `@next/swc-*`. Không thêm
hoặc xóa package entry. Một số binary Linux thêm metadata libc; các ràng buộc
dependency của Next/ESLint được cập nhật theo package mới. Phiên bản đã khóa của
React, Supabase, Prisma và các package khác không đổi. Script test 60 ca là thay
đổi từ lượt review trước, không phải nâng dependency bổ sung.

Phiên bản thực tế khớp lockfile:

| Package | Phiên bản |
| --- | --- |
| next | 16.4.6 |
| eslint-config-next | 16.4.6 |
| @supabase/supabase-js | 2.119.2 |
| @supabase/ssr | 0.12.7 |
| react / react-dom | 19.2.8 |

Không cài thêm package, sửa package/lockfile, chạy audit fix hoặc nâng cấp tự động
trong task này. Giữ nguyên cập nhật do người dùng đã thực hiện.

## Kiểm tra trước build và cách cô lập

Đã đọc hướng dẫn Next.js 16.4.6 được cài tại node_modules/next/dist/docs về Server
Components, fetching, environment variables và Turbopack root; đồng thời kiểm
tra next.config.mjs, layout/page, metadata, DAL, proxy, các service và Server
Actions liên quan.

Các đường có khả năng truy vấn nếu được render/đánh giá:

| Đường | Truy vấn liên quan |
| --- | --- |
| Root layout | listGenres → genres; getCurrentUser → users/profiles nếu có phiên |
| / và /Home | getHomeSections → novels cùng quan hệ genres/statistics/reviews/bookshelves |
| /search | listNovels → novels và các quan hệ |
| Metadata/trang truyện, chương, profile | novels/chapters/chapter_contents/reviews/users/profiles/follows |
| /Writer | Chỉ đọc sau kiểm tra phiên/quyền; thao tác ghi nằm trong Server Actions |
| /api/health | SELECT novels khi endpoint được gọi |

Không có generateStaticParams chủ động nạp dữ liệu; các thao tác INSERT/UPDATE/
DELETE/upload nằm trong hàm action/service, không phải tác vụ top-level lúc
import. Locale/session dùng cookies khiến các route ứng dụng cuối cùng được
build ở chế độ dynamic. Không dùng điều này để bỏ qua kiểm soát network.

Phiên kiểm thử cuối dùng bản sao riêng trong
`backend/.local/final-build-verification/app-1795747982939/`:

- Sao chép source/public/config và dependency đã cài; loại `.env*`. Không đọc
  file `.env` đang mở trong Downloads hoặc đưa credential thật vào bản sao.
- Tiến trình con nhận whitelist biến hệ thống tối thiểu. URL/key Supabase và
  AUTH_SECRET đều là giá trị giả; URL SDK chỉ tới HTTP fixture `127.0.0.1`.
- Fixture trả danh sách rỗng cho SELECT, chỉ chấp nhận GET/HEAD của các resource
  đã kiểm tra; từ chối thao tác ghi. Không có PostgreSQL/database phía fixture.
- Node preload chặn đích mạng ngoài loopback và hai host Google Fonts công khai;
  chặn request ghi tới fixture. Đã thử guard fail-closed trước khi build.
- Dùng CLI Next từ cùng bản sao dependency. Config bản sao chỉ thêm
  turbopack.root trỏ đúng thư mục cô lập; không đổi tính năng hay bundler. Config
  và source trong repository giữ nguyên.

Build không truy cập Supabase thật. Fixture nhận đúng một GET genres từ smoke
test SDK; bản thân lượt build cuối không phát sinh thêm request dữ liệu đến
fixture. Không có request ghi tới fixture hoặc đích Node bị chặn trong build.
Google Fonts được tải như tài nguyên công khai của next/font/google.

Đã đối chiếu hash của 152 input source/public/config/package trước/sau kiểm
thử: các file gốc giữ nguyên. Đây là test build bằng cấu hình giả, không phải
artifact mang cấu hình production của nhóm để triển khai.

## Kết quả thực tế

| Kiểm tra | Kết quả |
| --- | --- |
| Import Supabase SDK thật | PASS |
| SDK 2.119.2 thực hiện SELECT đến fixture loopback | PASS |
| Guard chặn request ngoài allowlist và POST tới fixture | PASS |
| Next.js production build mặc định Turbopack | **PASS, exit code 0** |
| Compile | Thành công, 115 giây trong lượt cuối |
| Collect page data và prerender | Thành công, **14/14** |
| Tối ưu production và route manifest | Thành công; 23 route ứng dụng dynamic và Proxy |
| npm test | **60/60 PASS** |
| ESLint các file Writer/retry/test liên quan với cấu hình 16.4.6 | PASS |
| npm audit --omit=dev | **0 vulnerabilities** |
| npm audit đầy đủ | **11 vulnerabilities: 4 high, 7 moderate** |
| git diff --check | PASS |

Không cần sửa lỗi source ứng dụng. Không chạy lại test database hoặc migration
vì task chỉ xác minh frontend build/dependency; không mở kết nối PostgreSQL.

Artifact kiểm tra được gitignore:

- `backend/.local/final-build-verification/result.json` — trạng thái kết quả và số request.
- `backend/.local/final-build-verification/build.log` — production build cuối.
- `backend/.local/final-build-verification/sdk.log`, `guard.log` — smoke SDK/guard.
- `backend/.local/final-build-tests.log`, `final-build-eslint.log` — regression/lint.
- `backend/.local/final-build-audit.json`, `final-build-audit-production.json` — audit thực tế.

Harness kiểm thử cũng nằm trong thư mục gitignore trên, không thay đổi cấu hình
hay script build của ứng dụng. Chạy lại trong workspace này bằng:

```powershell
node backend/.local/final-build-verification/run.cjs C:\Novely\Novely\backend\.local\final-build-verification\app-1795747982939
npm.cmd test
git diff --check
```

Harness sử dụng fixture mới và biến giả mỗi lượt; cần quyền tải font công khai.
Không chạy npm run build với môi trường thật chỉ để lặp lại bài kiểm tra cô lập.

## 11 cảnh báo development còn lại

Đã chạy audit lại sau nâng cấp. Mức độ dưới đây theo npm audit, không phải 11 lỗi
độc lập trong source Novely: các cảnh báo lan truyền theo ba nhóm dependency.
Tất cả entry bị đánh dấu dev trong lockfile; không xuất hiện khi omit=dev.

| Nhóm/package | Phiên bản bị báo | Số cảnh báo | Đánh giá |
| --- | --- | ---: | --- |
| effect, @prisma/config, prisma | 3.20.0 / 7.10.1 / 7.10.1 | 3 high | ReDoS khi xử lý chuỗi qua template schema; ở đây thuộc chuỗi Prisma CLI |
| zod | 4.6.5 | 1 high | Có thể tăng sử dụng bộ nhớ khi kiểm tra collection quá lớn |
| minimatch, typescript-eslint và @typescript-eslint/{eslint-plugin, parser, type-utils, typescript-estree, utils} | minimatch lồng 10.2.6; các gói TypeScript-ESLint 8.71.0 | 7 moderate | Glob pattern có thể làm tăng CPU/bộ nhớ trong chuỗi lint/parser |

Nguồn tác giả cho cơ chế ảnh hưởng:
[Effect advisory](https://github.com/Effect-TS/effect/security/advisories/GHSA-7589-6fvf-x4pw),
[minimatch advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249),
[Zod pull request sửa giới hạn collection](https://github.com/colinhacks/zod/pull/6652).

Đánh giá cho repository hiện tại: chưa thấy source ứng dụng import các package
này làm runtime validation; ảnh hưởng trước mắt tập trung ở công cụ phát triển/
CI xử lý input, schema hoặc pattern không tin cậy. Giữ kế hoạch vá từng nhóm
kèm kiểm thử riêng. Npm có gợi ý downgrade major Prisma trong fixAvailable;
không áp dụng để tránh phá stack Prisma 7 đã thống nhất. Không chạy audit fix
--force và không sửa dependency ngoài phạm vi.

## File thay đổi và Git

Task này chỉ tạo báo cáo `docs/backend-final-build-verification.md` và artifact
kiểm thử gitignore. Không sửa source, package.json/package-lock.json hoặc config
gốc. Các file có thay đổi trước khi task bắt đầu được giữ nguyên.

Git status sau task gồm 7 tracked file modified, 11 project file untracked và
cache PowerShell untracked đã có trước:

```text
 M backend/README.md
 M backend/transition-tests/migration.test.js
 M database/migrations/README.md
 M docs/database-migration-preparation.md
 M package-lock.json
 M package.json
 M src/server/services/writer.js
?? Microsoft/Windows/PowerShell/ModuleAnalysisCache
?? database/checks/legacy-data-fingerprint.sql
?? database/checks/legacy-preflight.sql
?? database/checks/migration-postflight.sql
?? database/checks/supabase-access-audit.sql
?? docs/backend-final-build-verification.md
?? docs/backend-predeployment-review.md
?? docs/supabase-deployment-runbook.md
?? src/server/retry-deadlock.mjs
?? tests/helpers/writer-server-mocks.mjs
?? tests/retry-deadlock.test.mjs
?? tests/writer-service.test.mjs
```

Kết quả PASS này giải quyết phần dependency/import SDK/build của lượt review
trước. Các gate PostgreSQL 17.12, quyền/RLS/default privileges và PostgREST trên
staging/Supabase trong Final Pre-deployment Review vẫn cần xác nhận riêng.
Không coi kết quả build là phê duyệt migration Supabase.
