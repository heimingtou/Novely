"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Clock3, Flame, PenLine, Search, SearchX } from "lucide-react";
import { categoryById, filterForumPosts, forumHref, normalizeFilters, removeForumPost, toggleForumFlag } from "@/lib/forum-model.mjs";
import ForumShell from "./ForumShell";
import { ForumAvatar } from "./ForumIcons";
import ForumPost from "./ForumPost";
import PostComposer from "./PostComposer";
import { useForumStore } from "./useForumStore";
import { useDemoSession } from "@/lib/useDemoSession";

export default function ForumFeed({ params }) {
  const { t } = useI18n();
  const { account } = useDemoSession();
  const router = useRouter();
  const [state, update, ready, failed] = useForumStore();
  const [composer, setComposer] = useState(null);
  const [notice, setNotice] = useState("");
  const filters = normalizeFilters(params);
  const posts = filterForumPosts(state, filters);
  const selected = categoryById(filters.category);
  function compose() { setComposer({}); }
  return (
    <ForumShell state={state} filters={filters} ready={ready} failed={failed} onCompose={compose}>
      <section className="forum-compose-card" aria-label={t("Bắt đầu một bài viết")}><ForumAvatar name={account?.name || t("Độc giả Novely")} /><button type="button" disabled={!ready} onClick={compose}>{t("Bạn đang đọc điều gì thú vị?")}</button><button type="button" className="forum-icon-button" aria-label={t("Viết bài mới")} disabled={!ready} onClick={compose}><PenLine size={19} /></button></section>
      <div className="forum-feed-card">
        <div className="forum-feed-tabs"><nav aria-label={t("Sắp xếp bài viết")}><Link href={forumHref({ ...filters, sort: "trending" })} aria-current={filters.sort === "trending" ? "page" : undefined}><Flame size={17} /> {t("Trending")}</Link><Link href={forumHref({ ...filters, sort: "latest" })} aria-current={filters.sort === "latest" ? "page" : undefined}><Clock3 size={17} /> {t("Latest")}</Link></nav><span>{posts.length} {t("bài viết")}</span></div>
        <div className="forum-feed-controls">
          <div><h2>{filters.saved ? t("Bài viết đã lưu") : t(selected?.name || "Dành cho người yêu truyện")}</h2><p>{t(selected?.description || "Những góc nhìn mới luôn bắt đầu từ một cuộc trò chuyện.")}</p></div>
          <form className="forum-search" role="search" aria-label={t("Tìm trong cộng đồng")} onSubmit={(event) => { event.preventDefault(); router.push(forumHref({ ...filters, query: String(new FormData(event.currentTarget).get("q") || "") })); }}><Search size={17} /><input key={filters.query} name="q" maxLength={100} defaultValue={filters.query} aria-label={t("Tìm bài viết")} placeholder={t("Tìm câu chuyện, tác giả, truyện…")} /><button type="submit" aria-label={t("Tìm kiếm bài viết")}><ArrowRight size={16} /></button></form>
          {filters.query && <p className="forum-search-result">{t("Kết quả cho “")}{filters.query}” · <Link href={forumHref({ ...filters, query: "" })}>{t("Xóa tìm kiếm")}</Link></p>}
        </div>
        <p className="forum-status" role="status">{t(notice)}</p>
        <div className="forum-feed-list" aria-busy={!ready}>
          {!posts.length && <div className="forum-empty"><SearchX size={34} /><h3>{filters.saved ? t("Chưa có bài viết đã lưu") : t("Chưa tìm thấy cuộc trò chuyện")}</h3><p>{filters.saved ? t("Bấm biểu tượng bookmark ở bài viết để giữ lại và đọc sau.") : t("Thử một từ khóa khác hoặc bắt đầu bài viết đầu tiên trong chủ đề này.")}</p><Link className="forum-button" href="/forum">{t("Xem tất cả bài viết")}</Link></div>}
          {posts.map((post) => <ForumPost key={post.id} post={post} state={state} ready={ready} onLike={(id) => update((current) => toggleForumFlag(current, "likes", id))} onSave={(id) => { update((current) => toggleForumFlag(current, "saved", id)); setNotice(state.saved.includes(id) ? t("Đã bỏ lưu bài viết.") : t("Đã lưu bài viết trên trình duyệt này.")); }} onEdit={(post) => setComposer({ post })} onDelete={(id) => { update((current) => removeForumPost(current, id)); setNotice(t("Đã xóa bài viết và các tương tác liên quan trên thiết bị.")); }} />)}
        </div>
        {posts.length > 0 && <p className="forum-feed-end">{t("Bạn đã xem hết các bài viết trong danh sách này.")}<span>{t("Câu chuyện tiếp theo có thể bắt đầu từ bạn.")}</span></p>}
      </div>
      {composer && <PostComposer post={composer.post} category={selected?.id || "general"} onClose={() => setComposer(null)} onSaved={(id) => { setComposer(null); router.push(`/forum/${id}`); }} />}
    </ForumShell>
  );
}
