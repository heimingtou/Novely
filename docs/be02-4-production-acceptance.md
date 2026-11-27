# BE02.4 — Nghiệm thu Production

Ngày review: 27/11/2026. Project Supabase: `sctbtzvlzrhrhqveceln`.
Branch nghiệm thu: `feature/backend-foundation`, HEAD
`0f755ce3a542f6739090ed96f1839a21d326f42f` trước commit tài liệu này.

**Migration Production: PASS, đã COMMIT theo xác nhận riêng của người dùng.**
**Mở lại Vercel: chưa đủ bằng chứng để Resume.** Cần xác minh deployment đang
gắn Production có bản Writer đã sửa retry; việc Resume vẫn cần xác nhận riêng.

## Bằng chứng database và PostgREST

Đã đọc báo cáo Apply cuối và đối chiếu hash của các artifact được báo cáo.
Không chạy lại migration, kiểm thử, seed hoặc thao tác ghi trong lượt nghiệm thu.

| Hạng mục | Kết quả nghiệm thu |
| --- | --- |
| Backup/restore | Backup mới ngoài repository; restore Local và dry-run rollback PASS |
| Production preflight | PostgreSQL 17.12, database/role postgres; đủ 16 bảng legacy, các gate đạt |
| Dry-run Production | PASS; rollback khôi phục catalog và fingerprint baseline |
| Apply | Gate trước COMMIT=true; log có COMMIT; gate sau COMMIT=true |
| Catalog sau COMMIT | 21 bảng, 70 index, 14 trigger, 7 hàm trigger, 10 sequence; index lỗi=0 |
| Dữ liệu cũ | Fingerprint/số dòng 16 bảng và sáu sequence gốc giữ nguyên |
| Nội dung/backfill | Mismatch=0, thiếu nội dung=0, parent sai chương=0 |
| Dữ liệu cũ được giữ | missing_statistics=1; không tự sửa để biến mọi chỉ số thành 0 |
| Quyền | 11 đối tượng mới owner-only; năm bảng Forum rỗng, RLS bật, policy=0 |
| Quyền ứng dụng | anon/authenticated/service_role không có quyền hiệu lực trên đối tượng Forum mới; grants legacy/default privileges giữ nguyên |
| Compatibility | Fixture hiện có hoàn tất; ROLLBACK TO SAVEPOINT trước COMMIT giữ nguyên |
| PostgREST Reader/Writer | 7/7 HEAD limit=0 trả 200, gồm quan hệ nội dung chương, genres, profiles, reviews và follows |
| PostgREST Forum | 10/10 GET limit=0 bị từ chối 42501: anon trả 401, service_role trả 403 |
| Authenticated | HTTP đã PASS trên Staging; Production kiểm tra quyền bằng SQL, không tạo JWT hoặc lặp lại bài thử |
| Kết thúc hậu kiểm | Transaction READ ONLY đã đóng; catalog sau COMMIT khớp trước COMMIT |

Migration đã nghiệm thu có SHA-256
`10177f25112d1b6f5c15327315cc673f3facdf5a0e673992e61c2b5cec51397d`.
Compatibility SQL có SHA-256
`6f6419c4b0a37336a142fa7c0cd86906638f79f1c8ac0cf5600486952579782f`.

Báo cáo Apply cuối có SHA-256 được ghi trong biên bản Local của lượt nghiệm thu.
Các bằng chứng sau chỉ giữ trong vùng Git ignore, không đưa vào commit:

- `backend/.local/production-review/production-apply.result.json`.
- `backend/.local/production-review/production-postgrest.result.json`.
- Các log before/expanded/postflight, SQL vận hành và dữ liệu restore tại cùng thư mục.

Không sửa SSL Enforcement production. Kết nối client tới Session Pooler giữ
verify-full và CA đã duyệt; pg_stat_ssl phản ánh chặng pooler tới PostgreSQL.
Chi tiết vận hành nằm trong [runbook](supabase-deployment-runbook.md).

## Bằng chứng ứng dụng và điều kiện Resume

Build Next.js cô lập đã PASS; SDK thật, Writer tạo/sửa/xóa, sync hai chiều và
HTTP authenticated đã PASS trên Staging. Đọc lại các báo cáo hiện có, không chạy
thêm build/test: [build](backend-final-build-verification.md),
[Staging](supabase-staging-verification.md).

Bản sửa Writer nằm tại commit
`48e33ef8a097401f50659c1bc57fb053bcbafb29`, là tổ tiên của HEAD đã review.
Helper chỉ retry 40P01 tối đa hai lần sau lần đầu, tái tạo query cho từng câu
ghi/xóa, giữ nguyên luồng metadata rồi chapter_contents. Không retry lại toàn
bộ Save/Create hoặc lỗi có kết quả COMMIT không rõ ràng.

Đã đọc trực tiếp metadata và source từ GitHub:

| Ref | Bằng chứng | Giới hạn |
| --- | --- | --- |
| feature/backend-foundation, 0f755ce | Remote khớp HEAD Local; blob helper retry khớp Local; Vercel status success | Chưa xác minh đây là deployment đang gắn Production |
| 48e33ef | Vercel status success cho commit có bản sửa Writer | Status không xác nhận production alias |
| main, 6acb8b7 | Vercel status success; Writer chưa import helper retry, file helper không tồn tại | Không được dùng riêng status này để cho phép Resume |

Deployment của HEAD đã review:
[Vercel 0f755ce](https://vercel.com/poem2/novely/JE6PJ7rMRRqTP2VU6sRSmA6t4iwq).
Deployment gắn với main tại thời điểm review:
[Vercel 6acb8b7](https://vercel.com/poem2/novely/EyVMiVmZxyNc6EzchPXCqEdn2RrY).
Đây là liên kết từ GitHub commit status, chưa phải bằng chứng alias Production.

Chưa có kết nối Vercel trong phiên công cụ, project metadata `.vercel` hoặc
credential CLI Vercel. API deployments công khai của GitHub trả danh sách trống;
không suy luận môi trường deploy từ commit status thành công.
Người dùng xác nhận Vercel do thành viên khác quản lý và đang chờ metadata
deployment từ thành viên đó. Ghi nhận PENDING; không chờ bằng chứng này để bắt
đầu BE02.5, không tự Resume website.

Để chuyển sang READY_TO_RESUME, cần metadata chỉ đọc từ Vercel xác nhận đúng
team/project `poem2/novely`, deployment Production ở trạng thái Ready, commit
chứa bản Writer đã review và production alias gắn đúng deployment. Cần xác nhận
cấu hình deployment trỏ đúng project Supabase; chỉ đối chiếu metadata/boolean,
không đưa giá trị key vào tài liệu. Sau đó mới xin xác nhận Resume; không yêu
cầu kiểm thử ghi mới hoặc JWT production.

## Rà soát Git và phạm vi commit

Đã quét nội dung văn bản tracked/untracked không bị ignore và đối chiếu trực
tiếp các credential trong file env Production ở bộ nhớ. Không phát hiện key
Production, JWT thật, private key hoặc token nhà cung cấp trong phạm vi đã quét.
Các URL có password được phát hiện chỉ thuộc `.env.example`, test Local hoặc
fixture giả `example.invalid`. Không kết luận thay cho rà soát toàn bộ lịch sử
Git hay nguồn gốc mọi asset nhị phân có sẵn.

Không có `.env` thật, log vận hành, dump hoặc SQL restore trong tracked/index.
`backend/.env` và `backend/.local/` được Git ignore. Env Production nằm ngoài
repository; không sao chép vào Git và không đưa credential vào báo cáo. Các
thay đổi của lượt kết thúc chỉ là tài liệu tổng hợp, không thêm dữ liệu hàng.

Commit dự kiến trên `feature/backend-foundation`:
`Hoàn tất migration database Supabase production`. Chỉ chọn bốn file:

- `docs/be02-4-production-acceptance.md`.
- `docs/supabase-deployment-runbook.md`.
- `backend/README.md`.
- `database/migrations/README.md`.

Cache nhị phân untracked `Microsoft/Windows/PowerShell/ModuleAnalysisCache`
không thuộc task, giữ nguyên và không đưa vào commit. Không dùng git add . hoặc
git add -A. Branch remote đã đối chiếu khớp HEAD Local; đích push dự kiến là
`origin/feature/backend-foundation`, không force push hoặc merge main.

Commit/push Backend Foundation đã được người dùng phê duyệt riêng trong lượt
chốt Git; việc Resume Vercel vẫn cần xác nhận riêng. BE02.4 đã nghiệm thu phần database;
bàn giao xác minh deployment và mở lại ứng dụng vẫn PENDING. BE02.5 được tiếp
tục riêng, không chạy lại migration hoặc kiểm thử BE02.4.
