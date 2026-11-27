# BE03.1 — Khảo sát và hợp đồng Auth/User

Ngày 27/11/2026. Branch `feature/auth-user` tạo từ đúng commit
`ef05a289fd90a8d81fc6c00c5e3706a46ff3455f` của `feature/backend-foundation`.
**Đề xuất để review, chưa triển khai API nghiệp vụ.** Chỉ thêm tài liệu này;
không sửa Frontend, dependency, schema/quyền Production hoặc Vercel; không
chạy lại kiểm thử Foundation. Cache Microsoft untracked có sẵn giữ nguyên.

## 1. Chức năng và hợp đồng đang chạy

| Luồng | Input và hành vi thực tế | Source |
| --- | --- | --- |
| Login | FormData identifier/password/rememberMe/next; identifier có @ tìm email lowercase, còn lại tìm username nguyên case; lỗi trả `{error:string}`, thành công set cookie, revalidate layout, redirect safeNext | [actions](../src/app/auth/actions.js#L34), [AuthForm](../src/components/auth/AuthForm.jsx#L15) |
| Register | username/email/password/confirmPassword/agreeTerms/next; email lowercase, role bắt buộc reader; insert users rồi profiles, đăng nhập ngay, TTL một ngày | [actions](../src/app/auth/actions.js#L59) |
| Logout | Xóa cookie và revalidate layout; client refresh, không có thu hồi JWT phía server | [actions](../src/app/auth/actions.js#L87), [provider](../src/components/auth/SessionProvider.jsx#L40) |
| Session/current user | JWT hợp lệ mới đọc lại users + avatar; user bị xóa trả null, đổi role có hiệu lực từ DB; DTO `{id,username,role,avatar,expiresAt}` | [DAL](../src/server/auth/dal.js#L19) |
| Trang user | Nhận ID số hoặc username; `/users/me` cần đăng nhập rồi redirect ID; metadata đọc như khách; chủ tài khoản thấy trường riêng và truyện nháp | [page](../src/app/users/[id]/page.js#L15), [service](../src/server/services/profiles.js#L17) |
| Public REST | GET `/api/users/:id` trả snake_case user/profile + published novels; không cùng DTO với trang hồ sơ | [route](../src/app/api/users/[id]/route.js#L5), [service](../src/server/services/users.js#L6) |
| Update profile | FormData username/email/bio/birthday/gender/phone/facebook, avatar File tùy chọn; actor lấy từ session, không nhận user ID; trả `{ok:true,message}` hoặc `{error:string}` | [action](../src/app/users/actions.js#L29), [form](../src/components/user-profile/ProfileContent.jsx#L126) |
| Follow toggle | Actor từ session, target ID nguyên dương và khác chính mình; INSERT/DELETE follows, trigger cập nhật counter; trả `{ok:true,following}` hoặc lỗi | [action](../src/app/users/actions.js#L87), [UI optimistic](../src/components/user-profile/ProfileActions.jsx#L28) |

Auth hiện dùng **users của ứng dụng + bcrypt + JWT riêng**, không dùng Supabase
Auth signIn/signUp. Các wrapper Supabase SSR tồn tại nhưng không phải luồng
đăng nhập này. Nút Google/Facebook chưa có handler; forgot-password chỉ có link,
không tìm thấy route xử lý. Không đưa OAuth, reset/change password, refresh token,
email verification, quản lý role hoặc xóa tài khoản vào phạm vi mới.

### JWT, cookie và quyền

- [token.js](../src/server/auth/token.js#L5): cookie novely_session, HS256,
  sub=user ID dạng string, role/iat/exp; AUTH_SECRET tối thiểu 32 ký tự.
  TTL 86400 giây, rememberMe 2592000 giây; expiresAt DTO là milliseconds.
- [session.js](../src/server/auth/session.js#L8): HttpOnly, SameSite=Lax,
  Path=/, Secure khi production, Max-Age theo TTL; không đặt Domain.
- [proxy.js](../src/proxy.js#L8) chỉ xác minh token để chặn sớm `/Writer`;
  [requireUser/assertUser](../src/server/auth/dal.js#L39) mới kiểm tra user thật.
  Không dùng role trong JWT làm quyền cuối cùng; không cache user theo biến global.
- [layout](../src/app/layout.js#L30) cấp user cho SessionProvider;
  [provider](../src/components/auth/SessionProvider.jsx#L13) giữ refresh khi logout,
  đồng bộ BroadcastChannel novely-auth và refresh lúc hết hạn. Navbar, forum và
  reader còn dùng [useDemoSession](../src/lib/useDemoSession.js#L8), nhưng phiên
  này đã là session thật, không phải localStorage.
- Mọi người đăng nhập đều có thể vào Writer theo kiểm tra hiện có; ownership
  ở service Writer vẫn là quyết định cuối. Auth/User không thêm quyền admin sửa
  user khác hoặc endpoint đổi role.

## 2. Validation và DTO phải giữ

Login: identifier trim, 1–255 ký tự; password 1–200, không trim. Remember checkbox
`on` thành boolean true. Register: username 3–50, `^[a-zA-Z0-9_.]+$`, giữ case;
email trim/lowercase, tối đa 255; password 6–200; confirm phải khớp; agreeTerms
`on` bắt buộc. safeNext chỉ nhận đường dẫn bắt đầu `/`, không `//` hoặc `/auth`.
Backend không nhận role, passwordHash, actor/viewer ID từ body để cấp quyền.

Password dùng [bcrypt cost 10 + dummy compare](../src/server/auth/password.js#L5),
tương thích hash seed `$2a$10$`. Giữ thông báo chung khi sai tài khoản/password;
lỗi trùng email/username vẫn phân biệt như hiện tại. Không tự siết password hoặc
đổi thuật toán. Schema nhận tới 200 ký tự nhưng bcrypt có giới hạn 72 byte theo
README package đang cài; cần quyết định tương thích riêng trước khi thay validation.

Profile: username 3–50; email lowercase; bio tối đa 300; birthday rỗng hoặc
YYYY-MM-DD hợp lệ từ 1900 đến ngày hiện tại; gender male/female/other hoặc rỗng;
phone tùy chọn `^\+?[0-9]{9,14}$`; facebook tối đa 500 và chuẩn hóa HTTPS bằng
[profile-model](../src/lib/profile-model.mjs#L3). Rỗng thành null trong DB; DTO
trang hồ sơ dùng chuỗi rỗng theo source. Prisma Date birthday phải serialize
YYYY-MM-DD, không đưa timestamp đầy đủ vào input date của UI.

Giữ ba DTO riêng, không trả raw Prisma record:

| DTO | Shape và giới hạn |
| --- | --- |
| SessionUser | id:number, username, role, avatar:string hoặc null, expiresAt:number milliseconds; không email/hash |
| PublicUserLegacy | user_id, username, role, level, created_at, profile `{avatar,bio,fb_link}` hoặc null, novels với novel_id/title/slug/cover_url/status/count_chapter/last_chapter_at; chỉ truyện published |
| ProfilePage | id/name/username/role/bio/avatar/facebook/createdAt/followers/following/isFollowing, stories/posts/reviews/followingUsers; owner mới có email/phone/birthday/gender/genderLabel |

[ProfilePage mapping](../src/server/services/profiles.js#L52) cần giữ published
filter theo owner, tối đa 20 review được lấy rồi lọc truyện published, tối đa
50 followingUsers; posts hiện là []. Actor lấy từ cookie, không nhận viewerId
qua query/body. GET metadata như khách phải bỏ cookie để không vô tình lấy DTO
riêng tư. IDs số ưu tiên user_id như source; username toàn số giữ giới hạn phân
giải hiện tại. `/users/me` của page không đồng nhất với username `me` trong REST.

Avatar hiện tối đa 2 MiB PNG/JPEG/WebP, kiểm tra magic bytes, bucket avatars,
key `<userId>/<uuid>.<ext>` và dọn ảnh cũ theo
[storage.js](../src/server/storage.js#L20). Không nhận avatar URL/object key tùy
ý từ client thay cho File. Giữ giới hạn tổng request tương thích cấu hình
[Server Actions 3mb](../next.config.mjs#L7), không dùng MIME/filename làm bằng chứng.

## 3. Endpoint Express đề xuất

Prefix `/api/v1`; thành công `{data:...}`, lỗi `{error:{code,message}}` khớp
[JSON convention](../src/server/http.js#L3) và middleware Express hiện có.
Các endpoint dưới là hợp đồng dự kiến, chưa được đăng ký vào router.

| Method/path | Quyền, input | Success |
| --- | --- | --- |
| POST /auth/login | Public; JSON identifier/password/rememberMe:boolean=false | 200 `{data:{user:SessionUser}}`, Set-Cookie |
| POST /auth/register | Public; JSON username/email/password/confirmPassword/agreeTerms:true | 201 `{data:{user:SessionUser}}`, Set-Cookie một ngày |
| POST /auth/logout | Cho phép cả session thiếu/hết hạn; xóa cookie | 200 `{data:{ok:true}}` |
| GET /auth/me | Cookie tùy chọn, luôn đọc lại user DB nếu JWT hợp lệ | 200 `{data:SessionUser hoặc null}` |
| GET /users/:idOrUsername | Public; giữ hợp đồng REST Next.js cũ | 200 `{data:PublicUserLegacy}` |
| GET /users/:idOrUsername/profile | Cookie tùy chọn; backend tính owner/isFollowing | 200 `{data:ProfilePage}` |
| PUT /users/me/profile | Bắt buộc auth; form đầy đủ với field hiện có, avatar tùy chọn | 200 `{data:{ok:true,message}}` |
| POST /users/:id/follow-toggle | Bắt buộc auth; target ID trên path, actor từ session | 200 `{data:{ok:true,following}}` |

Form update hiện gửi đầy đủ dữ liệu, nên chọn PUT thay vì hứa hỗ trợ PATCH từng
field. Có thể nhận JSON khi không có avatar, multipart khi có avatar, cùng một
validation/normalization. Multipart phải có giới hạn trước khi buffer/parse;
xác minh phương án API native Node 24 hoặc giữ adapter Storage Next hiện tại
đến lượt review Storage. Không cài parser/dependency mới trong BE03.1 và không
cutover update profile nếu chưa bảo toàn avatar.

Không trả token trong JSON, không thêm Bearer/localStorage/refresh endpoint.
Không thêm iss/aud bắt buộc hoặc xoay AUTH_SECRET làm mất hiệu lực JWT đang dùng.
AUTH_SECRET giữa Express và Next proxy phải thống nhất qua cấu hình server-only;
chưa đọc/copy giá trị secret hoặc thay env runtime trong lượt khảo sát này.

Lỗi đề xuất: 400 VALIDATION_ERROR cho field/target sai, 401 UNAUTHORIZED khi sai
login hoặc thiếu session ở route bắt buộc, 403 FORBIDDEN/ORIGIN_DENIED, 404 NOT_FOUND,
409 EMAIL_EXISTS/USERNAME_EXISTS hoặc xung đột follow, 413 PAYLOAD_TOO_LARGE,
503 DATABASE_UNAVAILABLE. Giữ message tiếng Việt và firstIssue của source;
adapter đổi error.message về error:string cho UI. Không suy luận lỗi unique từ
SQL message thô. GET /auth/me không biến lỗi DB thành 200/null; layout Next vẫn
có thể degrade về user=null qua catch hiện có. Response có session/private DTO
đặt Cache-Control:no-store; không log password, cookie, JWT hoặc hash.

Cookie mutation của Express cần kiểm tra Origin theo allowlist frontend cho
mọi request thay đổi trạng thái; Next adapter chuyển Origin đã được kiểm tra.
CORS credentials hiện có không thay thế CSRF check. Backend không giả định có
các bảo vệ Server Actions của Next trên REST và không mở wildcard origin.
Không tự retry follow-toggle khi lỗi mạng vì có thể đã commit.

## 4. Tái sử dụng và ranh giới phải port

| Source | Có thể giữ/tái sử dụng | Điều chỉnh bắt buộc khi triển khai sau review |
| --- | --- | --- |
| token.js | Logic jose, claims, TTL, verify portable, không có Next import | Chốt cách đóng gói shared code; không đổi chữ ký cookie/token |
| password.js | Giữ nguyên cost 10, hash/verify/dummy behavior | Bỏ ràng buộc server-only trong adapter Express, không import nguyên module Next |
| profile-model.mjs | Import trực tiếp module mjs thuần JS; cùng validation client/server | Chốt đóng gói nếu backend deploy độc lập khỏi root src |
| Auth/User actions | Tái dùng schema, whitelist, normalization, error strings | Tách I/O Next cookies/redirect/revalidate khỏi service Express |
| profiles/users services | Giữ projections, DTO mappings, published/owner rules | Đổi Supabase query sang Prisma; không import server-only, alias @/ hoặc React cache vào Express |
| Backend Foundation | ApiError/error mapping, JSON replacer, transaction runner, Prisma lifecycle, CORS | Bổ sung auth theo request; không cache session toàn tiến trình |
| Storage | Giữ magic-byte/type/size/key/cleanup semantics | Prisma không thay Supabase Storage; adapter và secret/bucket scope cần review riêng |

Đã kiểm tra package manifests/resolution: jose và bcryptjs khai báo ở root,
backend chưa khai báo cả jose/bcryptjs/Zod. Zod 4.6.5 hiện đến từ root node_modules,
lock đánh dấu dev; backend resolve cả ba nhờ cây thư mục root. Không coi đó là
đóng gói backend production độc lập đã đạt. Lượt triển khai cần review việc khai
báo/đóng gói đúng các thư viện **đã có**, không thêm thư viện mới; BE03.1 không
sửa manifest, lockfile hoặc chạy install.

## 5. Prisma, quyền DB và RLS cần review

Giữ [schema chuyển tiếp](../backend/prisma/transition/schema.prisma#L325):
User→users, Profile→profiles theo user_id, Follow→follows với PK compound
follower_id/follow_id. Profile nullable/optional, DATE birthday; role reader/
author/admin và unique username/email do DB bảo vệ. Dùng thêm Novel/Review chỉ
đọc để giữ DTO trang hồ sơ, không mở API nghiệp vụ Novel/Review ở task này.

Đối chiếu snapshot catalog Production đã lưu từ BE02.4, không truy vấn cloud
mới: user_id là IDENTITY ALWAYS, defaults role=reader, username 3–50, profile
phone/date/gender/facebook có CHECK; follows có FK hai user và CHECK không tự
follow. Một số tên PK/unique trong Prisma khác tên constraint legacy thực tế
(pk_users/uq_users_email/uq_users_username/pk_follows/pk_profiles). Không sinh
DDL để đổi tên; error adapter phải xử lý tên/field thực tế có kiểm soát.

| Luồng | Quyền cần thiết dự kiến, chưa cấp |
| --- | --- |
| Login/session/public user | SELECT users trên đúng cột id/username/email/password_hash/role/level/created_at/counters theo từng repository; password_hash chỉ đọc nội bộ login |
| Profile public/private | SELECT profiles với whitelist công khai; trường riêng chỉ xuất DTO cho owner; auth lấy ID từ session đã verify |
| Register | INSERT users trên username/email/password_hash, role reader bằng default; INSERT profiles(user_id), SELECT cột RETURNING; transaction atomic cho hai bảng |
| Update self | UPDATE users(username,email,updated_at); INSERT/UPDATE profiles trên cột form/ảnh đã kiểm tra; không role/password/counters qua body |
| Follow | SELECT/INSERT/DELETE follows; trigger invoker hiện có cần SELECT/UPDATE count_following/count_follower trên cả actor và target user |
| Profile aggregates | SELECT đúng cột novels/reviews/follows; published filters và giới hạn giữ nguyên |

Chỉ đề xuất column-level grants cần dùng, không GRANT ALL, ownership hoặc
BYPASSRLS. IDENTITY không đồng nghĩa tự động xin ALL trên sequence; kiểm chứng
quyền DML/RETURNING bằng role Local/Staging trước khi chốt quyền sequence cần thiết.
Chưa viết hay thực thi GRANT/RLS mới trong BE03.1.

RLS phải được thiết kế riêng cho backend role: lookup credential trước login cần
SELECT được user phù hợp theo identifier; đăng ký chưa có session; update chỉ
chủ hồ sơ; follow phải cho trigger cập nhật counter target mà không cho endpoint
sửa hồ sơ target. Không lấy auth.uid() của Supabase Auth làm ID cho JWT riêng,
không nhận app user context từ client. Nếu dùng transaction-local actor context,
server chỉ set sau xác minh token/DB user và phải chứng minh không rò qua pool.
Không cấp UPDATE users rộng hoặc sửa function/counter chỉ để làm follow PASS.

Profile Supabase hiện [bắt buộc read-only](../backend/src/config/database.js#L81)
và [chặn mọi quyền dữ liệu ngoài genres](../backend/src/database/verify-supabase.js#L46).
Chỉ GRANT thêm sẽ khiến admission từ chối hoặc DML bị read-only chặn. Cần review
đồng bộ access mode/allowlist/RLS trước triển khai Auth/User; giữ Foundation mode
an toàn mặc định, chưa tắt read-only hay thay role settings Production.

Đăng ký hiện có thể tạo user nhưng thiếu profile khi bước sau lỗi; profile update
có thể lưu username/email trước khi upload/upsert lỗi. Đề xuất transaction Prisma
cho phần DB; upload không nằm trong transaction PostgreSQL, phải có cleanup bù
và chỉ xóa ảnh cũ sau DB commit. Đây là thay đổi nội bộ cần review, giữ nguyên
shape thông báo/thành công của Frontend.

## 6. Tích hợp Frontend: cần duyệt ranh giới server, không đổi UI

Khuyến nghị giữ Next làm lớp BFF cùng origin: component tiếp tục gọi đúng Server
Actions, layout/provider/proxy hiện có. Action/service adapter gọi Express bằng
URL cấu hình server-only, chuyển duy nhất cookie phiên/Origin cần thiết;
Set-Cookie từ server fetch **không tự đến trình duyệt**, nên action phải phản
chiếu đúng novely_session qua async cookies(). Giữ redirect/revalidatePath tại
Next, cùng TTL/Secure/SameSite và chuyển JSON errors về ActionState cũ.

Các file src cần xin duyệt **trước khi sửa**, khi cutover:

| File | Lý do và thay đổi tối thiểu | Ảnh hưởng giữ nguyên |
| --- | --- | --- |
| src/app/auth/actions.js | Gọi REST login/register/logout, map FormData boolean, mirror cookie | AuthForm không đổi; lỗi string, next, refresh/redirect giữ nguyên |
| src/app/users/actions.js | Proxy update/follow; map response về `{ok,message,following}` | ProfileContent/ProfileActions không đổi; optimistic rollback giữ nguyên |
| src/server/auth/dal.js | getCurrentUser gọi /auth/me với cookie, vẫn export requireUser/assertUser | Layout, SessionProvider, navbar và Writer không đổi |
| src/server/services/profiles.js | Trả nguyên ProfilePage DTO từ Express; metadata guest không chuyển cookie | Page profile/metadata, private fields và drafts giữ nguyên |
| src/server/services/users.js | Trả data từ REST public Express, unwrap một lớp envelope | Route /api/users/:id có thể giữ nguyên |

Không cần sửa AuthForm, SessionProvider, Navbar, ProfileContent, ProfileActions,
layout, proxy hoặc UI forum/reader theo phương án này. Không sửa đồng thời cả
route API users và service nếu thay service đã đủ. Không giả lập giao thức
Server Actions trong Express hoặc chuyển browser sang REST mà chưa được duyệt.
Hiện tất cả file src và config Frontend giữ nguyên.

## 7. Thứ tự BE03 và gate review

1. **BE03.1 (lượt này):** chốt inventory, tám endpoint/DTO và phương án BFF;
   review dependency packaging, phạm vi avatar và thiết kế quyền/RLS.
2. **Lượt Auth kế tiếp:** implement Local middleware/JWT/cookie, login/register/
   logout/me với transaction và tests Auth riêng; không chạy lại Foundation.
   Kiểm tra token hiện hữu, expiry/remember, user deleted/role changed và CSRF.
3. **Lượt User-read:** public REST + ProfilePage projections, private owner data,
   published/draft/review/following semantics; không rò PII/cross-user cache.
4. **Lượt User-write/Storage:** update profile/avatar và follow/counter; chứng minh
   least-privilege/RLS/trigger với fixture Local/Staging, kiểm tra lỗi/cleanup/race.
5. **Cutover sau phê duyệt riêng:** duyệt các adapter src tối thiểu, cấu hình secret
   và quyền Production, rồi kiểm tra tương thích có phạm vi. Vercel/deployment
   không tự thay đổi; giữ verification pending và không merge main.

Chỉ review source, package/lock và metadata catalog đã lưu; không chạy test,
không tạo JWT, không đọc secret env, không gọi Production DB/API trong BE03.1.
Hợp đồng này chưa phải nghiệm thu API đã triển khai. Không commit/push trong
lượt khảo sát; chờ review hợp đồng trước khi viết API nghiệp vụ.
