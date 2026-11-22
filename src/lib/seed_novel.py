#!/usr/bin/env python3
"""
Sinh dữ liệu mẫu cho NOVEL PLATFORM (PostgreSQL 15+) -> file seed.sql

Sinh đủ 16 bảng: users, profiles, follows, genres, novels, novel_genres,
novel_likes, chapters, chapter_contents, chapter_likes, bookshelves,
reading_progress, comments, reviews, interact_novel, interact_novel_day.

Dữ liệu nhất quán:
  - Tác giả truyện (novels.author_id) là user có role 'author'.
  - Thời gian hợp lý: user tạo trước truyện, truyện trước chương, chương
    xuất bản trước khi được like/bình luận...
  - Cột đếm (users.count_following/count_follower, novels.count_like,
    chapters.count_like/count_comment) KHÔNG ghi tay: trigger trong
    schema_v2.sql / migration_counters.sql tự tính khi chèn bảng chi tiết.
  - novels.count_chapter = số chương đã xuất bản, last_chapter_at = chương mới nhất.
  - interact_novel.view = tổng count_view các chương; phân bổ tuổi/giới tính
    theo hồ sơ người đọc thật trong reading_progress.
  - Mật khẩu mọi tài khoản: 123456 (bcrypt qua pgcrypto, dùng được với
    bcrypt / bcryptjs / PHP password_verify / passlib).

Không cần cài thư viện. Cách dùng:
    python seed_novel.py                      # tạo seed.sql (mặc định)
    python seed_novel.py --users 500 --novels 150 --reset
    psql -U postgres -d ten_database -f seed.sql

Yêu cầu: database đã có cột đếm + trigger (schema_v2.sql hoặc migration_counters.sql).
"""

import argparse
import random
import unicodedata
from datetime import date, datetime, timedelta, timezone

# ===================================================================== dữ liệu gốc

HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
      "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Trịnh", "Đinh", "Mai", "Tô"]
DEM_NAM = ["Văn", "Minh", "Đức", "Quốc", "Hữu", "Thành", "Gia", "Hoàng", "Anh", "Tuấn"]
DEM_NU = ["Thị", "Ngọc", "Thu", "Thanh", "Mỹ", "Bảo", "Khánh", "Phương", "Hải", "Diệu"]
TEN_NAM = ["An", "Bình", "Cường", "Dũng", "Đạt", "Hải", "Hiếu", "Huy", "Khang", "Khoa",
           "Long", "Minh", "Nam", "Nhân", "Phong", "Phúc", "Quân", "Sơn", "Tài", "Thắng",
           "Thiện", "Trung", "Tú", "Vinh", "Việt"]
TEN_NU = ["Anh", "Chi", "Dung", "Giang", "Hà", "Hân", "Hương", "Lan", "Linh", "Mai",
          "My", "Ngân", "Nhi", "Nhung", "Oanh", "Phương", "Quyên", "Thảo", "Trang", "Trâm",
          "Uyên", "Vân", "Vy", "Xuân", "Yến"]

GENRES = ["Tiên Hiệp", "Kiếm Hiệp", "Huyền Huyễn", "Đô Thị", "Ngôn Tình", "Xuyên Không",
          "Trọng Sinh", "Lịch Sử", "Quân Sự", "Khoa Huyễn", "Võng Du", "Đồng Nhân",
          "Linh Dị", "Trinh Thám", "Hài Hước", "Học Đường", "Điền Văn", "Cung Đấu",
          "Hệ Thống", "Mạt Thế", "Đam Mỹ", "Bách Hợp", "Truyện Ngắn", "Phiêu Lưu"]

TITLE_A = ["Kiếm", "Thần", "Đế", "Tiên", "Long", "Phượng", "Huyết", "Vạn", "Thiên", "Ma",
           "Thánh", "Cửu", "Lăng", "Phong", "Vân", "Nguyệt", "Tinh", "Hỏa", "Băng", "Mộng"]
TITLE_B = ["Đạo", "Tôn", "Vương", "Giới", "Hoàng", "Ký", "Truyện", "Thần", "Tộc", "Vực",
           "Lộ", "Môn", "Kiếp", "Hồn", "Tâm", "Cốc", "Sơn", "Quyết", "Ảnh", "Ca"]
TITLE_PHRASES = [
    "Mùa Hè Năm Ấy", "Thanh Xuân Của Chúng Ta", "Người Ấy Ở Cuối Con Đường",
    "Nhật Ký Xuyên Không", "Ta Ở Dị Giới Làm Ruộng", "Tổng Tài Lạnh Lùng",
    "Bí Ẩn Ngôi Nhà Số 7", "Trở Về Năm Mười Tám Tuổi", "Hệ Thống Thần Hào",
    "Thám Tử Học Đường", "Ngày Tận Thế Thứ Ba", "Cô Gái Bán Trà Sữa",
    "Đệ Nhất Thần Y", "Hồi Ức Sài Gòn", "Chuyện Tình Phố Cổ", "Tiệm Sách Lúc Nửa Đêm",
    "Vương Phi Thất Sủng", "Kỷ Nguyên Robot", "Bảy Ngày Ở Đà Lạt", "Lời Nguyền Dòng Sông",
]
TITLE_SUFFIX = ["", "", "", " Truyền Kỳ", " Ngoại Truyện", " Chi Lộ", " Phần 2", " Hồi Ức"]

PLACES = ["Thanh Vân Tông", "thành Lạc Dương", "Hắc Phong Sơn", "trấn Bình An", "Vạn Kiếm Các",
          "Sài Gòn", "Hà Nội", "phố cổ Hội An", "Đà Lạt", "học viện Thiên Long",
          "khu rừng phía bắc", "Thiên Đô", "bến sông cũ", "tòa tháp bỏ hoang", "ngôi làng nhỏ"]
OBJECTS = ["thanh kiếm cổ", "chiếc nhẫn ngọc", "cuốn bí kíp", "lá thư cũ", "tấm bản đồ",
           "viên linh thạch", "chiếc điện thoại", "bức ảnh ố vàng", "chiếc hộp gỗ", "mảnh ngọc bội"]
FEELINGS = ["bồi hồi", "lo lắng", "kinh ngạc", "phẫn nộ", "bình thản", "ấm áp",
            "nghi hoặc", "quyết tâm", "hoang mang", "vui mừng"]
TIMES = ["Sáng hôm sau", "Đêm khuya", "Lúc hoàng hôn", "Ba ngày sau", "Chẳng bao lâu",
         "Khi trời vừa hửng sáng", "Giữa trưa", "Tối hôm đó", "Một tháng sau", "Đúng lúc ấy"]
WEATHER = ["Gió lạnh thổi qua", "Mưa rơi lất phất", "Trăng sáng vằng vặc", "Nắng chiếu xiên qua khe cửa",
           "Sương mù giăng kín lối đi", "Tiếng ve râm ran", "Bầu trời xám xịt"]
CH_TITLES = ["Khởi đầu", "Gặp gỡ", "Bí mật", "Thử thách", "Biến cố", "Truy đuổi",
             "Đột phá", "Hiểu lầm", "Trở về", "Quyết chiến", "Chia ly", "Hội ngộ",
             "Âm mưu", "Lựa chọn", "Bước ngoặt", "Sự thật", "Lời hứa", "Bão tố",
             "Ánh sáng", "Hồi kết"]

SENTENCES = [
    "{T}, {A} đứng trước {P}, trong lòng {F} khó tả.",
    "{A} nhìn {B} rồi khẽ nói: “Chúng ta không còn nhiều thời gian nữa.”",
    "{W}, {A} siết chặt {O} trong tay.",
    "“Ngươi thật sự muốn biết sự thật sao?” {B} hỏi, giọng trầm xuống.",
    "Không ai ngờ rằng {O} lại ẩn chứa bí mật lớn đến vậy.",
    "{A} hít sâu một hơi, cảm giác {F} dâng lên trong lồng ngực.",
    "Tin tức về {P} nhanh chóng lan khắp nơi.",
    "{B} mỉm cười, ánh mắt thoáng qua một tia {F}.",
    "Con đường phía trước còn rất dài, nhưng {A} không hề chùn bước.",
    "{T}, {B} tìm đến {A} với vẻ mặt {F}.",
    "{C} lặng lẽ quan sát mọi chuyện từ xa, không nói một lời.",
    "Tiếng bước chân vang lên, phá tan sự im lặng của {P}.",
    "“Nếu lần này thất bại, mọi thứ sẽ kết thúc,” {A} thầm nghĩ.",
    "{W}, cả {P} chìm trong yên tĩnh lạ thường.",
    "{A} và {B} nhìn nhau, không cần nói cũng hiểu đối phương muốn gì.",
    "Ký ức năm xưa bỗng ùa về khiến {A} thoáng chốc thất thần.",
    "{C} cười lạnh: “Các ngươi nghĩ có thể thoát khỏi đây sao?”",
    "Đó là lần đầu tiên {A} cảm thấy {F} đến như vậy.",
    "Mọi người xung quanh đều sững sờ trước cảnh tượng trước mắt.",
    "{B} đặt {O} lên bàn, chậm rãi kể lại mọi chuyện.",
]

COMMENTS = [
    "Chương này hay quá, hóng chương sau!", "Tác giả ra chương đều quá, cảm ơn ạ.",
    "Đoạn cuối căng thẳng thật sự.", "Nhân vật chính ngày càng có chiều sâu.",
    "Cho mình hỏi khi nào ra chương mới vậy?", "Đọc đến đây nổi da gà luôn.",
    "Hơi ngắn nhưng vẫn rất cuốn.", "Mình đoán {B} chính là người đứng sau mọi chuyện.",
    "Tình tiết này hơi khó hiểu, ai giải thích giúp với.", "Tuyệt vời, đã thêm vào tủ truyện!",
    "Ủng hộ tác giả!", "Chương này buồn quá huhu.", "Hài thật sự, cười muốn xỉu.",
    "Đợi mãi mới có chương mới.", "Văn phong mượt, đọc rất thích.",
]
REPLIES = ["Đồng ý với bạn!", "Mình cũng nghĩ vậy.", "Chưa chắc đâu, chờ xem tiếp.",
           "Haha đúng thật.", "Bạn đọc kỹ đoạn trước sẽ hiểu.", "+1", "Chuẩn luôn."]
REVIEWS = {
    5: ["Truyện xuất sắc, cốt truyện chặt chẽ, nhân vật có chiều sâu.", "Một trong những bộ hay nhất mình từng đọc.",
        "Rất đáng đọc, tác giả viết đều và chắc tay."],
    4: ["Truyện hay, đôi chỗ hơi chậm nhưng tổng thể rất ổn.", "Cốt truyện cuốn, mong tác giả giữ phong độ."],
    3: ["Đọc giải trí được, chưa có gì quá đặc sắc.", "Mở đầu hay nhưng đoạn giữa hơi lan man."],
    2: ["Tình tiết hơi dễ đoán.", "Nhân vật phụ chưa được xây dựng kỹ."],
    1: ["Không hợp gu mình lắm.", "Bỏ dở sau vài chương."],
}
BIOS = ["Mê đọc truyện tiên hiệp.", "Đọc truyện mỗi tối trước khi ngủ.", "Fan ngôn tình chính hiệu.",
        "Thích truyện trinh thám và kinh dị.", "Sinh viên năm 3, rảnh là đọc truyện.",
        "Viết truyện để thỏa đam mê.", "Một người kể chuyện bằng chữ.", "Cảm ơn mọi người đã ủng hộ truyện của mình!",
        None, None]

# ===================================================================== tiện ích

def unaccent(s):
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def slugify(s):
    out, prev_dash = [], False
    for c in unaccent(s).lower():
        if c.isascii() and c.isalnum():
            out.append(c); prev_dash = False
        elif not prev_dash:
            out.append("-"); prev_dash = True
    return "".join(out).strip("-")


def q(v):
    """Python -> literal SQL."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, datetime):
        return "'" + v.strftime("%Y-%m-%d %H:%M:%S+00") + "'"
    if isinstance(v, date):
        return "'" + v.isoformat() + "'"
    return "'" + str(v).replace("'", "''") + "'"


def rand_time(start, end):
    if end <= start:
        return end
    return start + timedelta(seconds=random.uniform(0, (end - start).total_seconds()))


def weighted_count(mean, cap):
    """Số ngẫu nhiên lệch về phía nhỏ (vài truyện rất hot, đa số bình thường)."""
    return min(cap, int(random.expovariate(1 / mean)))


class SqlWriter:
    def __init__(self, path, batch=500):
        self.f = open(path, "w", encoding="utf-8")
        self.batch = batch

    def raw(self, s=""):
        self.f.write(s + "\n")

    def insert(self, table, cols, rows, overriding=False):
        if not rows:
            return
        head = f"INSERT INTO {table} ({', '.join(cols)})"
        if overriding:
            head += " OVERRIDING SYSTEM VALUE"
        for i in range(0, len(rows), self.batch):
            chunk = rows[i:i + self.batch]
            self.raw(head + " VALUES")
            self.raw(",\n".join("(" + ", ".join(q(v) for v in r) + ")" for r in chunk) + ";")
        self.raw()

    def close(self):
        self.f.close()


# ===================================================================== sinh dữ liệu

def gen_users(n, n_authors, now):
    users, used = [], set()
    start = now - timedelta(days=730)
    for uid in range(1, n + 1):
        gender = random.choices(["male", "female", "other", None], [45, 45, 4, 6])[0]
        if gender == "female":
            name = f"{random.choice(HO)} {random.choice(DEM_NU)} {random.choice(TEN_NU)}"
        else:
            name = f"{random.choice(HO)} {random.choice(DEM_NAM)} {random.choice(TEN_NAM)}"
        parts = unaccent(name).lower().split()
        base = parts[-1] + parts[0] + (parts[1][0] if len(parts) > 2 else "")
        if uid == 1:
            username, role = "admin", "admin"
        else:
            username = base
            while username in used:
                username = f"{base}{random.randint(1, 9999)}"
            role = "author" if uid <= n_authors + 1 else "reader"
        used.add(username)
        # tác giả lập tài khoản sớm hơn để có thời gian đăng truyện
        late = now - timedelta(days=120 if role == "author" else 3)
        created = start if uid == 1 else rand_time(start, late)
        users.append({
            "id": uid, "name": name, "username": username, "role": role, "gender": gender,
            "email": f"{username}@example.com",
            "created": created,
            "level": 1 if role == "reader" and random.random() < .3 else random.randint(1, 60),
            "verified": random.random() < .85,
            "birthday": None if random.random() < .15 else date(random.randint(1965, 2012),
                                                                    random.randint(1, 12), random.randint(1, 28)),
        })
    return users


def gen_profile(u):
    phone = None
    if random.random() < .7:
        phone = random.choice(["03", "05", "07", "08", "09"]) + "".join(random.choices("0123456789", k=8))
        if random.random() < .2:
            phone = "+84" + phone[1:]
    bio = random.choice(BIOS)
    if u["role"] == "author":
        bio = f"{u['name']} - " + random.choice(["tác giả truyện mạng.", "viết truyện từ năm 2019.",
                                                   "chuyên thể loại huyền huyễn.", "mong được mọi người ủng hộ."])
    return [u["id"], u["birthday"], u["gender"], phone,
            f"https://facebook.com/{u['username']}" if random.random() < .5 else None,
            f"https://api.dicebear.com/9.x/avataaars/svg?seed={u['username']}" if random.random() < .9 else None,
            bio]


def make_title(used):
    for _ in range(50):
        if random.random() < .45:
            t = random.choice(TITLE_PHRASES) + random.choice(TITLE_SUFFIX)
        else:
            a, b = random.sample(TITLE_A, 2)
            t = f"{a} {b} {random.choice(TITLE_B)}" + random.choice(TITLE_SUFFIX)
        if slugify(t) not in used:
            return t
    return t + f" {len(used)}"


def make_paragraphs(cast, n_par):
    pars = []
    for _ in range(n_par):
        s = []
        for _ in range(random.randint(3, 6)):
            s.append(random.choice(SENTENCES).format(
                A=cast[0], B=cast[1], C=cast[2], P=random.choice(PLACES), O=random.choice(OBJECTS),
                F=random.choice(FEELINGS), T=random.choice(TIMES), W=random.choice(WEATHER)))
        pars.append(" ".join(s))
    return "\n\n".join(pars)


def main():
    ap = argparse.ArgumentParser(description="Sinh seed.sql cho Novel Platform (PostgreSQL)")
    ap.add_argument("--users", type=int, default=200, help="tổng số user (mặc định 200)")
    ap.add_argument("--authors", type=int, default=30, help="số user là tác giả (mặc định 30)")
    ap.add_argument("--novels", type=int, default=60, help="số truyện (mặc định 60)")
    ap.add_argument("--min-chapters", type=int, default=5)
    ap.add_argument("--max-chapters", type=int, default=30)
    ap.add_argument("--paragraphs", type=int, default=12, help="số đoạn văn trung bình mỗi chương")
    ap.add_argument("--password", default="123456", help="mật khẩu chung cho mọi tài khoản")
    ap.add_argument("--password-hash", help="dùng sẵn chuỗi hash này thay vì tạo bcrypt bằng pgcrypto")
    ap.add_argument("--reset", action="store_true", help="XÓA SẠCH dữ liệu 16 bảng trước khi chèn")
    ap.add_argument("--seed", type=int, default=42, help="seed ngẫu nhiên (cùng seed = cùng dữ liệu)")
    ap.add_argument("-o", "--out", default="seed.sql")
    a = ap.parse_args()
    if a.authors >= a.users:
        ap.error("--authors phải nhỏ hơn --users")

    random.seed(a.seed)
    now = datetime.now(timezone.utc).replace(microsecond=0)
    w = SqlWriter(a.out)

    w.raw("-- Dữ liệu mẫu Novel Platform - sinh bởi seed_novel.py")
    w.raw(f"-- users={a.users} authors={a.authors} novels={a.novels} seed={a.seed}")
    w.raw("BEGIN;")
    w.raw("SET client_encoding = 'UTF8';\n")
    w.raw("DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_follows_count') THEN\n"
          "    RAISE EXCEPTION 'Chưa có trigger cột đếm. Chạy migration_counters.sql (hoặc dùng schema_v2.sql) trước.';\n"
          "  END IF;\nEND $$;\n")
    tables = ["interact_novel_day", "interact_novel", "reviews", "comments", "reading_progress",
              "bookshelves", "chapter_likes", "chapter_contents", "chapters", "novel_likes",
              "novel_genres", "novels", "genres", "follows", "profiles", "users"]
    if a.reset:
        w.raw(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE;\n")
    else:
        w.raw("DO $$ BEGIN\n  IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM genres) THEN\n"
              "    RAISE EXCEPTION 'Bảng users/genres đã có dữ liệu. Sinh lại file với --reset để xóa và nạp lại.';\n"
              "  END IF;\nEND $$;\n")

    # ---------------------------------------------------------------- users + profiles
    users = gen_users(a.users, a.authors, now)
    by_id = {u["id"]: u for u in users}
    authors = [u for u in users if u["role"] == "author"]

    cols = ["user_id", "level", "created_at", "updated_at", "email_verified",
            "username", "email", "role"]
    rows = [[u["id"], u["level"], u["created"], rand_time(u["created"], now), u["verified"],
             u["username"], u["email"], u["role"]] for u in users]
    if a.password_hash:
        hash_sql = q(a.password_hash)
    else:
        w.raw("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
        hash_sql = f"crypt({q(a.password)}, gen_salt('bf', 10))"
    w.raw("-- users (mọi tài khoản chung 1 mật khẩu; hash tính 1 lần cho nhanh)")
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        w.raw(f"WITH pw AS (SELECT {hash_sql} AS h)\n"
              f"INSERT INTO users ({', '.join(cols)}, password_hash) OVERRIDING SYSTEM VALUE\n"
              f"SELECT v.user_id, v.level, v.created_at::timestamptz, v.updated_at::timestamptz,\n"
              f"       v.email_verified, v.username, v.email, v.role, pw.h\n"
              f"FROM (VALUES")
        w.raw(",\n".join("(" + ", ".join(q(x) for x in r) + ")" for r in chunk))
        w.raw(f") AS v({', '.join(cols)}) CROSS JOIN pw;\n")

    w.insert("profiles", ["user_id", "birthday", "gender", "phone_number", "fb_link", "avatar", "bio"],
             [gen_profile(u) for u in users])

    # follows: user hay follow tác giả
    follows = set()
    for u in users:
        for _ in range(random.randint(0, 8)):
            target = random.choice(authors) if random.random() < .7 else random.choice(users)
            if target["id"] != u["id"]:
                follows.add((u["id"], target["id"]))
    w.insert("follows", ["follower_id", "follow_id", "created_at"],
             [[f, t, rand_time(max(by_id[f]["created"], by_id[t]["created"]), now)] for f, t in sorted(follows)])

    # ---------------------------------------------------------------- genres
    genres = [(i, g, slugify(g)) for i, g in enumerate(GENRES, 1)]
    w.insert("genres", ["genre_id", "name", "slug"], [list(g) for g in genres], overriding=True)

    # ---------------------------------------------------------------- novels + chapters
    novels, chapters, used_slugs = [], [], set()
    ch_id = 0
    for nid in range(1, a.novels + 1):
        au = random.choice(authors)
        title = make_title(used_slugs)
        slug = slugify(title)
        if slug in used_slugs:
            slug = f"{slug}-{nid}"
        used_slugs.add(slug)
        created = rand_time(au["created"], now - timedelta(days=2))
        published = random.random() < .9
        n_ch = random.randint(a.min_chapters, a.max_chapters)
        status = "completed" if published and random.random() < .3 else "ongoing"
        popularity = random.expovariate(1 / 800) + 30  # lượt xem chương 1
        nov = {"id": nid, "author": au["id"], "title": title, "slug": slug, "created": created,
               "published": published, "status": status, "chapters": [], "popularity": popularity,
               "genres": random.sample(range(1, len(genres) + 1), random.randint(1, 3)),
               "upper18": random.random() < .1, "vip": random.random() < .15}
        # chương cuối của truyện đang ra có thể là bản nháp
        n_draft = 0 if status == "completed" or not published else random.choice([0, 0, 1, 2])
        n_draft = min(n_draft, n_ch - 1) if published else n_ch
        times = sorted(rand_time(created, now - timedelta(hours=6)) for _ in range(n_ch))
        cast = random.sample([n.split()[-1] for n in (u["name"] for u in random.sample(users, 6))], 3) \
            if len(users) >= 6 else ["Lâm", "Vy", "Hạo"]
        if len(set(cast)) < 3:
            cast = ["Lâm Phong", "Tiểu Vy", "Hắc Hạo"]
        nov["cast"] = cast
        for num in range(1, n_ch + 1):
            ch_id += 1
            is_pub = num <= n_ch - n_draft
            n_par = max(3, int(random.gauss(a.paragraphs, a.paragraphs / 4)))
            content = make_paragraphs(cast, n_par)
            views = int(popularity * (0.93 ** (num - 1)) * random.uniform(.7, 1.3)) if is_pub else 0
            ch = {"id": ch_id, "novel": nid, "num": num, "published": is_pub,
                  "pub_at": times[num - 1] if is_pub else None, "created": times[num - 1],
                  "title": f"Chương {num}: {random.choice(CH_TITLES)}",
                  "content": content, "words": len(content.split()), "views": views,
                  "likes": [], "comments": 0}
            nov["chapters"].append(ch)
            chapters.append(ch)
        pub_ch = [c for c in nov["chapters"] if c["published"]]
        nov["count"] = len(pub_ch)
        nov["last_at"] = max((c["pub_at"] for c in pub_ch), default=None)
        novels.append(nov)

    w.insert("novels", ["novel_id", "author_id", "last_chapter_at", "created_at", "updated_at",
                        "count_chapter", "published", "upper18", "vip", "status", "title", "slug",
                        "cover_url", "description"],
             [[n["id"], n["author"], n["last_at"], n["created"], n["last_at"] or n["created"], n["count"],
               n["published"], n["upper18"], n["vip"], n["status"], n["title"], n["slug"],
               f"https://picsum.photos/seed/{n['slug']}/300/450",
               f"{n['cast'][0]} vô tình có được {random.choice(OBJECTS)} tại {random.choice(PLACES)}. "
               f"Từ đó, cuộc đời {n['cast'][0]} rẽ sang một hướng hoàn toàn khác, gắn liền với "
               f"{n['cast'][1]} và những bí ẩn mà {n['cast'][2]} che giấu suốt nhiều năm."]
              for n in novels], overriding=True)

    w.insert("novel_genres", ["novel_id", "genre_id"],
             [[n["id"], g] for n in novels for g in sorted(n["genres"])])

    # ---------------------------------------------------------------- tương tác người đọc
    novel_likes, bookshelves, progress, chapter_likes = [], [], [], []
    comments, reviews = [], []
    cm_id = 0
    readers_of = {}
    for n in novels:
        pub = [c for c in n["chapters"] if c["published"]]
        if not n["published"] or not pub:
            readers_of[n["id"]] = []
            continue
        first_pub = pub[0]["pub_at"]
        pool = [u for u in users if u["id"] != n["author"] and u["created"] < now - timedelta(hours=1)]
        k = min(len(pool), max(1, weighted_count(min(25, len(pool) / 3) + n["popularity"] / 200, len(pool))))
        audience = random.sample(pool, k)
        readers_of[n["id"]] = audience
        for u in audience:
            t0 = max(u["created"], first_pub)
            if random.random() < .5:
                novel_likes.append([u["id"], n["id"], rand_time(t0, now)])
            if random.random() < .4:
                bookshelves.append([u["id"], n["id"], rand_time(t0, now)])
            reached = random.randint(1, len(pub))
            cur = pub[reached - 1]
            progress.append([u["id"], n["id"], rand_time(max(t0, cur["pub_at"]), now), cur["id"],
                             round(reached / len(pub), 3)])
            if random.random() < .35:
                r = random.choices([5, 4, 3, 2, 1], [40, 30, 15, 9, 6])[0]
                reviews.append([u["id"], rand_time(t0, now), n["id"], r,
                                random.choice(REVIEWS[r]) if random.random() < .8 else None])
            # like / bình luận trên các chương đã đọc
            for c in pub[:reached]:
                ct0 = max(u["created"], c["pub_at"])
                if random.random() < .15:
                    c["likes"].append(u["id"])
                    chapter_likes.append([u["id"], c["id"], rand_time(ct0, now)])
                if random.random() < .06:
                    cm_id += 1
                    t = rand_time(ct0, now)
                    deleted = rand_time(t, now) if random.random() < .03 else None
                    comments.append([cm_id, None, t, t, deleted, u["id"], c["id"],
                                     random.choice(COMMENTS).format(B=n["cast"][1])])
                    c["comments"] += 1
                    root_id, root_t = cm_id, t
                    for _ in range(random.choice([0, 0, 0, 1, 1, 2, 3])):
                        ru = random.choice(audience)
                        if ru["created"] > now - timedelta(minutes=5):
                            continue
                        cm_id += 1
                        rt = rand_time(max(root_t, ru["created"]), now)
                        comments.append([cm_id, root_id, rt, rt, None, ru["id"], c["id"],
                                         random.choice(REPLIES)])
                        c["comments"] += 1
        for c in pub:  # lượt xem >= số người like
            c["views"] = max(c["views"], len(c["likes"]))

    w.insert("novel_likes", ["user_id", "novel_id", "created_at"], novel_likes)

    w.raw("-- chapters (count_like / count_comment để 0, trigger tự cộng khi chèn likes / comments)")
    w.insert("chapters", ["chapter_id", "novel_id", "published_at", "created_at", "updated_at",
                          "chapter_number", "word_count", "count_view", "status", "title"],
             [[c["id"], c["novel"], c["pub_at"], c["created"], c["pub_at"] or c["created"], c["num"],
               c["words"], c["views"], "published" if c["published"] else "draft", c["title"]]
              for c in chapters],
             overriding=True)
    w.f.flush()

    w.raw("-- chapter_contents")
    w.insert("chapter_contents", ["chapter_id", "content"], [[c["id"], c["content"]] for c in chapters])
    w.insert("chapter_likes", ["user_id", "chapter_id", "created_at"], chapter_likes)
    w.insert("bookshelves", ["user_id", "novel_id", "saved_at"], bookshelves)
    w.insert("reading_progress", ["user_id", "novel_id", "last_read_at", "chapter_id", "progress_percent"],
             progress)
    w.insert("comments", ["comment_id", "parent_id", "created_at", "updated_at", "deleted_at",
                          "user_id", "chapter_id", "content"], comments, overriding=True)
    w.insert("reviews", ["user_id", "created_at", "novel_id", "rating", "content"], reviews)

    # ---------------------------------------------------------------- thống kê
    def age_bucket(u):
        if not u["birthday"]:
            return "age_unknown"
        age = (now.date() - u["birthday"]).days // 365
        return "under_eighteen" if age < 18 else "eighteen_to_thirty_five" if age <= 35 else "over_thirty_five"

    def split(total, weights):
        """Chia total theo tỉ lệ weights, tổng đúng bằng total."""
        s = sum(weights.values())
        if not s:
            return {k: 0 for k in weights}
        out = {k: int(total * v / s) for k, v in weights.items()}
        rest = total - sum(out.values())
        for k in sorted(weights, key=lambda k: -weights[k])[:rest]:
            out[k] += 1
        return out

    inter, inter_day = [], []
    likes_per_novel = {}
    for _, nid, _ in novel_likes:
        likes_per_novel[nid] = likes_per_novel.get(nid, 0) + 1
    for n in novels:
        total = sum(c["views"] for c in n["chapters"])
        rd = readers_of[n["id"]]
        ages = {k: 0 for k in ["under_eighteen", "eighteen_to_thirty_five", "over_thirty_five", "age_unknown"]}
        gens = {"male": 0, "female": 0, "gender_other": 0, "unknown": 0}
        for u in rd:
            ages[age_bucket(u)] += 1
            gens[{"male": "male", "female": "female", "other": "gender_other"}.get(u["gender"], "unknown")] += 1
        ages = split(total, ages) if rd else {**ages, "age_unknown": total}
        gens = split(total, gens) if rd else gens
        inter.append([total, n["last_at"] or n["created"], n["id"], ages["under_eighteen"],
                      ages["eighteen_to_thirty_five"], ages["over_thirty_five"], ages["age_unknown"],
                      gens["male"], gens["female"], gens["gender_other"]])
        # 30 ngày gần nhất
        if n["published"] and total:
            first = min((c["pub_at"] for c in n["chapters"] if c["pub_at"]), default=now)
            budget_v, budget_l = total // 3, likes_per_novel.get(n["id"], 0)
            for d in range(30):
                day = now.date() - timedelta(days=d)
                if day < first.date():
                    break
                v = int(random.uniform(.2, 1.8) * budget_v / 30)
                l = min(budget_l, random.choice([0, 0, 1, 1, 2]))
                budget_l -= l
                inter_day.append([n["id"], day, v, l])

    w.insert("interact_novel", ["view", "updated_at", "novel_id", "under_eighteen", "eighteen_to_thirty_five",
                                "over_thirty_five", "age_unknown", "male", "female", "gender_other"], inter)
    w.insert("interact_novel_day", ["novel_id", "day", "count_view", "count_like"], inter_day)

    # ---------------------------------------------------------------- đồng bộ sequence IDENTITY
    w.raw("-- cho IDENTITY chạy tiếp từ giá trị lớn nhất, để web insert bình thường không bị trùng khóa")
    w.raw("DO $$ BEGIN")
    for t, col in [("users", "user_id"), ("genres", "genre_id"), ("novels", "novel_id"),
                   ("chapters", "chapter_id"), ("comments", "comment_id"), ("reviews", "review_id")]:
        w.raw(f"  PERFORM setval(pg_get_serial_sequence('{t}', '{col}'), "
              f"COALESCE((SELECT MAX({col}) FROM {t}), 0) + 1, false);")
    w.raw("END $$;")
    w.raw("\nCOMMIT;")
    w.close()

    print(f"Đã tạo {a.out}:")
    for name, n in [("users", len(users)), ("  - tác giả", len(authors)), ("profiles", len(users)),
                    ("follows", len(follows)), ("genres", len(genres)), ("novels", len(novels)),
                    ("chapters", len(chapters)), ("novel_likes", len(novel_likes)),
                    ("chapter_likes", len(chapter_likes)), ("bookshelves", len(bookshelves)),
                    ("reading_progress", len(progress)), ("comments", len(comments)),
                    ("reviews", len(reviews)), ("interact_novel_day", len(inter_day))]:
        print(f"  {name:<20} {n:>7,}")
    print(f"\nĐăng nhập thử: admin@example.com / {a.password}  (tác giả: {authors[0]['email']})")


if __name__ == "__main__":
    main()
