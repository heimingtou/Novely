# BE02.1 — Đối chiếu schema với khảo sát Supabase

Phạm vi: cập nhật schema mục tiêu và kiểm thử trên PostgreSQL Local. Không kết
nối Supabase, không thực hiện migration, không sửa Frontend hoặc Backend BE01.
`database/schema.sql` là DDL dành cho database rỗng, **không phải migration script**.

## Nguồn đối chiếu

- Baseline trong repository: commit `b80277e`, bộ kiểm thử cũ 374/374 PASS.
- Schema cũ tại `6acb8b7` không ghi `ON DELETE`, nên mặc định là `NO ACTION`.
- Khảo sát Supabase do nhóm cung cấp ghi nhận 16 bảng, 38 index, 8 trigger,
  5 hàm trigger và 6 cột `IDENTITY ALWAYS`. Hành vi xóa thực tế khác SQL cũ.
- Ưu tiên hành vi trong khảo sát. Các trigger trong schema mới tái tạo hành vi
  được mô tả; chưa thể khẳng định giống hoàn toàn thân hàm trên cloud vì chưa
  có toàn bộ định nghĩa hàm và index từ khảo sát.
- Theo xác nhận của người dùng: `progress_percent` là tỷ lệ `[0,1]`;
  `scroll_position` là số pixel nguyên không âm, không bị giới hạn ở 1.

Các số liệu Supabase dưới đây là thông tin nhóm cung cấp, không phải kết quả
truy vấn độc lập trong task này:

| Bảng | Số dòng khảo sát |
| --- | ---: |
| users | 202 |
| profiles | 202 |
| novels | 61 |
| chapters | 1.054 |
| chapter_contents | 1.054 |
| chapter_likes | 2.101 |
| comments | 1.749 |
| bookshelves | 642 |
| reading_progress | 1.530 |
| reviews | 526 |
| follows | 746 |
| novel_likes | 743 |

Khảo sát ghi nhận không có tiêu đề chương rỗng, chương thiếu nội dung hoặc phản
hồi khác chương; có **1 truyện thiếu thống kê**. Chưa có kết quả kiểm tra toàn bộ
dữ liệu theo các CHECK/UNIQUE mới, nên chưa đủ cơ sở triển khai migration cloud.

## Đúng 19 bảng mục tiêu

`users`, `profiles`, `follows`, `novel_likes`, `novels`, `chapters`, `genres`,
`novel_genres`, `bookshelves`, `reading_progress`, `comments`, `reviews`,
`interact_novel`, `interact_novel_day`, `forum_category`, `forum_post`,
`forum_comment`, `forum_reaction`, `forum_report`.

So với 16 bảng hiện có: gộp `chapter_contents` vào `chapters.content`, loại
`chapter_likes` khỏi thiết kế mục tiêu và thêm 5 bảng Forum. Không tạo bảng thứ 20.

## Ràng buộc và hành vi xóa

Giữ các cột authentication, User–Profile 1:0..1, cấm tự follow, khóa duy nhất
`chapters(novel_id, chapter_number)`, phản hồi cùng chương/bài viết, một đánh giá
mỗi user/truyện với rating 1–5, một Library/progress mỗi user/truyện và bốn trạng
thái Library. Thêm CHECK: chương `published` phải có `published_at`.

| Quan hệ | ON DELETE | Ảnh hưởng |
| --- | --- | --- |
| profiles, follows, novel_likes, bookshelves, reviews → user/truyện | CASCADE | Hard delete cha xóa các bản ghi phụ thuộc. |
| chapters → novels; novel_genres → novels; analytics → novels | CASCADE | Xóa truyện xóa chương, liên kết thể loại và thống kê. |
| comments → users/chapters/parent comment | CASCADE | Xóa cha có thể xóa cả phản hồi của người dùng khác. Soft delete chỉ ẩn bản ghi đó. |
| reading_progress → users/novels | CASCADE | Không giữ tiến độ nếu user hoặc truyện đã bị xóa. |
| reading_progress(chapter_id, novel_id) → chapters | SET NULL (chapter_id) | Giữ novel_id, tỷ lệ và pixel khi chương bị xóa. UI phải xử lý chapter_id=null. |
| novels → author; novel_genres → genre | RESTRICT | Chặn xóa tác giả còn truyện và thể loại còn được sử dụng. |
| Cả 9 FK Forum | NO ACTION | Chặn hard delete cha còn tham chiếu. Chưa áp dụng xóa dây chuyền Forum. |

Tổng cộng 30 FK: 18 CASCADE, 2 RESTRICT, 1 SET NULL theo cột, 9 NO ACTION.
Giữ `ON UPDATE NO ACTION` cho tất cả FK. Hard delete cần được kiểm tra phân quyền
và xác nhận nghiệp vụ ở ứng dụng; không coi CASCADE là cơ chế cấp quyền xóa.

## Trigger và quyền sở hữu counter

Schema mục tiêu có 11 trigger ứng dụng và 4 hàm trigger:

- `trg_comments_count` / `update_comments_count()`: INSERT/DELETE và UPDATE
  `deleted_at, chapter_id`; chỉ đếm `deleted_at IS NULL`, xử lý chuyển chương,
  soft delete, restore và thao tác không làm thay đổi số lượng.
- `trg_follows_count` / `update_follows_count()`: tăng/giảm cả
  `users.count_following` và `users.count_follower`, kể cả đổi hai đầu quan hệ.
- `trg_novel_likes_count` / `update_novel_likes_count()`: cập nhật
  `novels.count_like`, kể cả chuyển like sang truyện khác hoặc đổi user.
- 8 trigger `trg_<table>_updated_at` dùng `set_updated_at()` trên users, novels,
  chapters, comments, bookshelves, reviews, forum_post và forum_comment.
  Mọi UPDATE chapters, kể cả chỉ sửa `content`, đều cập nhật timestamp.

Counter được cập nhật bằng phép cộng/trừ nguyên tử. Các đích của cùng một lần
thay đổi được cập nhật theo ID tăng dần để giảm nguy cơ khóa chéo; chưa có kiểm
thử tải/đồng thời nhiều kết nối. Không dùng cách ép counter âm về 0 để che lệch dữ
liệu. Phải đối soát counter cũ trước migration.

Hàm truy cập bảng bằng `public.<table>`, cố định `search_path=pg_catalog` và dùng
`SECURITY INVOKER`. Chưa cấp grants hoặc thiết kế RLS trong task này. Kiểm thử
bằng user postgres Local không chứng minh quyền của role ứng dụng trên cloud.

Service tiếp tục tính `chapters.word_count`, `novels.count_chapter`,
`last_chapter_at` và `published` như `refreshNovelCounters()` hiện tại. Không thêm
trigger tính lại các cột đó. Không khôi phục `chapter_likes`,
`chapters.count_like` hoặc `trg_chapter_likes_count`. Không tạo thống kê cho truyện
bằng trigger mới; 1 truyện thiếu thống kê cần được xử lý theo kế hoạch migration.

## Index

Mục tiêu có 57 index: 19 từ PK, 11 từ UNIQUE, 27 khai báo riêng. Giữ index phục vụ
truy vấn FK và thứ tự danh sách; không tạo bản sao PK/UNIQUE. Thêm
`interact_novel_day_day_novel_idx(day, novel_id)` vì PK `(novel_id, day)` không có
`day` ở đầu, phục vụ lọc/xử lý theo ngày trên nhiều truyện. Cần đối chiếu workload
và EXPLAIN trên staging sau này; task này chưa chứng minh hiệu năng.

Bộ kiểm thử kiểm tra index hợp lệ, thứ tự cột, bao phủ tiền tố của 30 FK và không
có index trùng hoàn toàn. Số 38 index của Supabase chỉ là số tổng từ khảo sát,
chưa đủ để quyết định cụ thể index cloud nào sẽ bị giữ, đổi tên hoặc loại bỏ.

## Những file cần đồng bộ ở task tiếp theo

| File | Việc cần làm khi chuyển sang schema mục tiêu |
| --- | --- |
| `src/server/services/chapters.js` | Đọc `chapters.content`, bỏ join chapter_contents và select chapters.count_like. |
| `src/server/services/writer.js` | Ghi nội dung chung hàng chapters; bỏ truy vấn hai bảng chương cũ; sửa thống kê like chương; rà soát chuỗi xóa thủ công và dùng transaction phù hợp. Giữ refreshNovelCounters/countWords. |
| `src/server/presenters.js` | Đối chiếu dữ liệu trình bày chương sau khi loại like chương. |
| `src/app/users/actions.js` | Giữ cơ chế ghi follows rồi để trigger đếm; không tăng/giảm counter lần thứ hai. |
| `src/lib/seed_novel.py` | Chưa chạy được với thiết kế mới: vẫn ghi chapter_contents/chapter_likes; cần viết lại fixture cho target khi được yêu cầu. |
| `src/app/library/page.js`, `src/lib/reader-model.mjs` và màn đọc | Library hiện còn localStorage; ánh xạ trạng thái, chapter_id nullable, đổi phần trăm hiển thị 0–100 ↔ tỷ lệ 0–1, giữ pixel. |
| `src/components/forum/useForumStore.js`, `src/lib/forum-model.mjs`, các component Forum | Hiện còn dữ liệu/store phía trình duyệt; tích hợp API sau, thống nhất ID, status và reaction. |
| `docs/backend.md`, `docs/reading-page.md`, `docs/forum.md` | Đồng bộ hướng dẫn/schema khi các module thực sự được chuyển đổi. Không làm theo hướng dẫn seed cũ với schema mục tiêu. |
| `backend/` | Giữ nguyên BE01; chưa có Prisma/database module để chuyển nghiệp vụ trong task này. |

19 bảng chưa đáp ứng đầy đủ My Clipping, highlight/bookmark đoạn, lưu bài Forum,
liên kết bài Forum với truyện, spoiler và reaction chương. Giữ giao diện hiện có,
không tự thêm bảng hoặc chuyển dữ liệu của các tính năng này trong task này.

## Kế hoạch bảo toàn dữ liệu trước migration Supabase

1. Lưu đầy đủ DDL, định nghĩa trigger/function/index, grants, RLS/policies,
   identity và bản sao lưu có thử phục hồi. Không chạy file tạo schema rỗng trên cloud.
2. Trên staging cô lập, kiểm tra đủ 30 FK, chapter_number trùng, published thiếu
   timestamp, rating/UNIQUE reviews, analytics trùng, giá trị progress và counter.
   Kiểm tra orphan, nội dung trùng chapter_id và độ dài dữ liệu Forum trước áp CHECK.
3. Thêm cột chapters.content theo migration riêng rồi copy nguyên văn 1.054 nội
   dung theo chapter_id, giữ xuống dòng/Unicode. So sánh từng ID, độ dài và hash;
   không chỉ so tổng số dòng, không tự thay nội dung thiếu bằng chuỗi rỗng. Chỉ
   chuyển reader/writer sang cột mới sau khi xác nhận đối soát và rollback được.
4. Sao lưu 2.101 chapter_likes và chapters.count_like với ID/timestamp trước khi
   loại khỏi schema đích. Thống nhất xử lý mất chức năng reaction chương và biểu
   đồ Writer; không chuyển like chương thành like truyện vì khác ý nghĩa.
5. Đối soát lại counter từ dữ liệu nguồn; chọn trigger làm chủ 3 nhóm counter.
   Khi import, không vừa nạp sẵn counter vừa để trigger cộng thêm. Thay trigger
   trong một kế hoạch có kiểm soát; không tạo song song hai trigger cùng chức năng.
   Quyết định bù thống kê cho 1 truyện còn thiếu, chưa thực hiện tại task này.
6. Giữ nguyên ID và identity; sau import staging đối chiếu sequence với MAX(id).
   Kiểm thử app role, grants/RLS và Supabase Storage bằng bộ ca riêng. Khảo sát
   cho biết cả 16 bảng bật RLS nhưng chưa thấy policy; cần kiểm chứng đầy đủ.
   Authentication hiện dùng users.user_id dạng số và JWT jose, không tự đồng nhất
   với auth.uid() UUID của Supabase Auth.
7. Kiểm thử hành vi xóa/soft delete, Library/Progress/Forum và toàn bộ luồng đọc,
   Writer, đăng nhập trên staging; đo thời gian khóa. Chốt cửa sổ triển khai,
   rollback và tương thích phiên bản ứng dụng trước khi được phép migration cloud.

## Chạy kiểm thử Local

Giữ nguyên `novely_test` cũ. Tạo database riêng bằng Terminal nếu chưa có; nhập
mật khẩu tại prompt psql, không đưa vào câu lệnh hoặc file:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE novely_reconcile_test;'
```

Từ repository, trong Terminal tương tác:

```powershell
& .\database\tests\run-be02_1.ps1
```

Script khóa đích `127.0.0.1:5432/novely_reconcile_test`, dừng khi gặp lỗi và chỉ
nạp DDL nếu chưa có bảng nghiệp vụ. DDL được giữ lại khi thành công; fixture
được bọc transaction và ROLLBACK, dùng ID tường minh nên không làm tăng sequence.
Không gọi DROP/TRUNCATE/reset. Chỉ dùng `-ReuseSchema` để chạy lại kiểm thử trên
chính schema mới còn rỗng; cờ này không cập nhật DDL đã thay đổi.

Log, exit code và SHA-256 schema nằm trong `database/tests/.local/reconciliation/`
(đã được gitignore). Không ghi mật khẩu vào log. Trước khi kết luận PASS phải có
`BE02.1 RESULT: PASS`, kiểm tra sau ROLLBACK: 19 bảng, 0 dòng, sequence chưa tăng.

## Kết quả kiểm thử của lần đối chiếu này

**Kết luận BE02.1: PASS trong phạm vi schema và kiểm thử Local.**

Schema đã được thực thi thành công trên `127.0.0.1:5432/novely_reconcile_test`
rỗng, PostgreSQL 18.3. Sau khi sửa expected SQLSTATE trong test, chạy lại bằng
`-ReuseSchema` trên chính 19 bảng mới còn rỗng; không thay đổi DDL giữa hai lần.
SHA-256 của schema được nạp và file hiện tại trùng nhau:
`B941D3B3DCA623A661C129B8CED8651E76D1C382B149B3725DCFEA8212964AE4`.

| Nhóm kiểm thử PostgreSQL | Số ca đạt |
| --- | ---: |
| PRIMARY KEY | 19 |
| FOREIGN KEY | 30 |
| UNIQUE | 11 |
| CHECK | 49 |
| NOT NULL | 109 |
| Metadata, index, cấu hình trigger và đối soát counter | 200 |
| Dữ liệu hợp lệ | 14 |
| Toàn vẹn liên bảng/giới hạn dữ liệu | 11 |
| Trigger bình luận | 5 |
| Trigger follow | 2 |
| Trigger novel like | 2 |
| Trigger updated_at và nội dung chương | 9 |
| ON DELETE | 17 |
| search_path của trigger | 1 |
| **Tổng cộng** | **479/479** |

Một ca hành vi có thể chứa nhiều bước và assertion; bảng trên đếm các kết quả
được lưu trong test_results. Ba UNIQUE composite gồm ID của chương/bình luận
đã được chứng minh bằng metadata; thử chèn trùng có thể bị PK cùng hàng chặn
trước UNIQUE, và báo cáo test thể hiện rõ constraint thực sự phát lỗi.

Kết quả cuối ghi `exitCode=0`, `BE02.1 RESULT: PASS` và sau ROLLBACK:
**19 bảng, 0 dòng fixture, sequence identity chưa tăng**. Đã xác nhận thực tế
**57 index, 11 trigger ứng dụng (không tính trigger FK nội bộ), 4 hàm trigger**.
Log thành công: `database/tests/.local/reconciliation/console-20261125T113548861.log`
và `be02_1-20261125T113548861.log`.

Backend BE01 đã chạy lại bằng `npm.cmd test` trong `backend/`: **42/42 PASS**.
`git diff --check`: PASS. Parser PowerShell của runner: PASS. Không dùng kết quả
374/374 của schema trước để thay thế kết quả kiểm thử schema mới.

Lượt đầu đã nạp schema thành công và dừng vì một ca kiểm thử cũ mong mã lỗi
`23503` cho xóa tác giả; PostgreSQL Local trả `23001` khi bị RESTRICT chặn.
Đã sửa expected SQLSTATE tương ứng, giữ kiểm tra chính xác tên constraint.
Tham khảo [bảng mã lỗi PostgreSQL 18](https://www.postgresql.org/docs/18/errcodes-appendix.html).

## Thay đổi repository và giới hạn kết luận

Branch vẫn là `feature/backend-foundation`. Ba file đã sửa:
`database/schema.sql`, `database/tests/be02_1.sql`, `database/tests/run-be02_1.ps1`.
Hai file mới: `database/tests/reconciliation.sql`, `docs/database-reconciliation.md`.
Cache `Microsoft/Windows/PowerShell/ModuleAnalysisCache` đã tồn tại trước task,
được giữ nguyên và không thuộc thay đổi này. Không commit/push.

Giữ nguyên database `novely_test`, code Frontend, code Backend BE01 và source
Supabase hiện tại. Chưa tích hợp Prisma, chưa chuyển BE02.2. Không kết nối cloud,
không tải dữ liệu người dùng thật, không thay RLS hoặc cấu hình bảo mật PostgreSQL.

PASS Local không xác nhận sẵn sàng migration cloud: còn phải kiểm thử quyền/RLS,
khả năng tương thích dữ liệu thật, toàn bộ DDL hiện hành và tải đồng thời trên
staging theo kế hoạch ở trên.
