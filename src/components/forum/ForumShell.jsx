"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import Link from "next/link";
import { ArrowRight, Bookmark, BookOpen, ChevronRight, Compass, MessageCircle, PenLine, ShieldCheck } from "lucide-react";
import { FORUM_CATEGORIES } from "@/data/forum.mjs";
import { categoryById, forumHref, getForumPosts } from "@/lib/forum-model.mjs";
import ForumIcon from "./ForumIcons";

export default function ForumShell({ children, state, filters, ready, failed, onCompose, detail = false }) {
  const { t, locale } = useI18n();
  const allPosts = getForumPosts(state);
  const selected = categoryById(filters?.category);
  const categoryCount = (id) => allPosts.filter((post) => post.category === id).length;
  return (
    <div className="novely-forum" lang={locale}>
      <div className="forum-page-heading"><div><span className="forum-eyebrow">{t("NOVELY COMMUNITY")}</span><h1>{detail ? t("Một cuộc trò chuyện hay") : t("Câu chuyện còn tiếp, cùng nhau.")}</h1><p>{t("Một nơi để chia sẻ, khám phá và gặp những người yêu trang sách.")}</p></div><button type="button" className="forum-button forum-primary" disabled={!ready} onClick={onCompose}><PenLine size={18} /> {t("Viết bài")}</button></div>
      <div className="forum-layout">
        <aside className="forum-sidebar" aria-label={t("Điều hướng cộng đồng")}>
          <div className="forum-sidebar-title"><span className="forum-community-icon"><MessageCircle size={21} /></span><div><strong>{t("Góc của độc giả")}</strong><span>{t("Những câu chuyện kết nối")}</span></div></div>
          <nav className="forum-category-nav" aria-label={t("Chủ đề cộng đồng")}>
            <Link className={!selected && !filters?.saved && !detail ? "is-active" : ""} aria-current={!selected && !filters?.saved && !detail ? "page" : undefined} href={forumHref({ ...filters, category: "all", saved: false })}><Compass size={18} /><span>{t("Tất cả chủ đề")}</span><small>{allPosts.length}</small></Link>
            <span className="forum-nav-caption">{t("KHÁM PHÁ")}</span>
            {FORUM_CATEGORIES.map((category) => <Link key={category.id} className={selected?.id === category.id ? "is-active" : ""} aria-current={selected?.id === category.id ? "page" : undefined} href={forumHref({ ...filters, category: category.id, saved: false })}><ForumIcon name={category.icon} /><span>{t(category.name)}</span><small>{categoryCount(category.id)}</small></Link>)}
            <Link className={filters?.saved ? "is-active" : ""} aria-current={filters?.saved ? "page" : undefined} href={forumHref({ ...filters, category: "all", saved: true })}><Bookmark size={18} /><span>{t("Bài đã lưu")}</span><small>{state.saved.length}</small></Link>
          </nav>
          <div className="forum-sidebar-note"><ShieldCheck size={17} /><p>{t("Một góc trò chuyện tử tế bắt đầu từ cách mình lắng nghe.")}</p></div>
        </aside>

        <div className="forum-center">
          {failed && <p className="forum-storage-warning" role="alert">{t("Không thể lưu trên trình duyệt. Thay đổi mới chỉ được giữ trong phiên này và sẽ mất khi tải lại.")}</p>}
          {children}
        </div>

        <aside className="forum-discover" aria-label={t("Khám phá cùng cộng đồng")}>
          <section className="forum-reading-card"><span className="forum-eyebrow">{t("ĐỌC CÙNG NHAU")}</span><div className="forum-book-art" aria-hidden="true"><BookOpen size={40} /><span>THƯ VIỆN<br />ÁNH TRĂNG</span><small>MINH THƠ HÀ</small></div><h2>Thư Viện Ánh Trăng</h2><p>{t("Một thư viện chỉ mở cửa dưới ánh trăng. Bạn đã sẵn sàng bước vào?")}</p><Link href="/novels/demo">{t("Khám phá truyện")} <ArrowRight size={15} /></Link></section>
          <section className="forum-community-guide"><h2>{t("Cùng giữ góc này dễ thương")}</h2><p><span>01</span>{t("Tôn trọng những góc nhìn khác nhau.")}</p><p><span>02</span>{t("Đánh dấu spoiler trước khi chia sẻ tình tiết.")}</p><p><span>03</span>{t("Giới thiệu truyện đúng chủ đề để mọi người dễ tìm.")}</p></section>
          <section className="forum-quick-topics"><h2>{t("Bắt đầu từ một chủ đề")}</h2>{FORUM_CATEGORIES.filter((category) => ["novel-discussion", "theory", "find-a-novel"].includes(category.id)).map((category) => <Link href={forumHref({ category: category.id })} key={category.id}><span>{t(category.label)}</span><ChevronRight size={14} /></Link>)}</section>
          <p className="forum-demo-note">{t("Bản demo · Tài khoản, nội dung và số liệu mẫu chỉ để minh họa. Bài đăng và tương tác của bạn lưu trên trình duyệt này, chưa chia sẻ với người dùng khác.")}</p>
        </aside>
      </div>
      <p className="forum-mobile-demo">{t("Bản demo: bài đăng và tương tác chỉ lưu trên trình duyệt này.")}</p>
    </div>
  );
}
