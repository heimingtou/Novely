"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bookmark, BookOpen, Eye, Heart, MessageCircle, Pencil, ShieldAlert, Trash2 } from "lucide-react";
import { getNovel } from "@/data/novels.mjs";
import { categoryById, forumHref, getPostStats, LOCAL_AUTHOR } from "@/lib/forum-model.mjs";
import { ForumAvatar } from "./ForumIcons";
import { useDemoSession } from "@/lib/useDemoSession";

export function ForumSpoiler({ children, label = "Bài viết có spoiler" }) {
  const { t, locale } = useI18n();
  const [revealed, setRevealed] = useState(false);
  return (
    <div className={`forum-spoiler ${revealed ? "is-revealed" : ""}`}>
      <button type="button" className="forum-spoiler-toggle" aria-expanded={revealed} onClick={() => setRevealed(!revealed)}><ShieldAlert size={17} /><span>{revealed ? t("Ẩn nội dung spoiler") : t(label)}</span><small>{revealed ? t("Thu gọn") : t("Bấm để xem")}</small></button>
      {revealed && <div className="forum-spoiler-content">{children}</div>}
    </div>
  );
}

export default function ForumPost({ post, state, ready, detail = false, onLike, onSave, onEdit, onDelete }) {
  const { t, locale } = useI18n();
  const { account } = useDemoSession();
  const stats = getPostStats(state, post);
  const category = categoryById(post.category);
  const novel = getNovel(post.novelId);
  const content = <>
    {detail ? <h2 className="forum-post-title">{post.title}</h2> : <h2 className="forum-post-title"><Link href={`/forum/${post.id}`}>{post.title}</Link></h2>}
    <p className={`forum-post-body ${detail ? "" : "forum-post-excerpt"}`}>{post.body}</p>
    {!detail && <Link className="forum-read-more" href={`/forum/${post.id}`}>{t("Tham gia thảo luận")} <ArrowRight size={13} /></Link>}
  </>;
  return (
    <article className={`forum-post ${detail ? "forum-post-detail" : ""}`} aria-label={post.spoiler ? t("Bài viết có spoiler") : post.title}>
      <div className="forum-post-top"><ForumAvatar name={post.authorName} /><div className="forum-post-author"><strong>{post.authorName}</strong><div>{novel && <><ArrowRight size={11} /><Link href={`/novels/${novel.id}`}>{novel.title}</Link></>}{!novel && <span>{t("Độc giả Novely")}</span>}</div></div><time className="forum-post-date" dateTime={post.createdAt}>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(post.createdAt))}{post.updatedAt && <span> {t("· Đã sửa")}</span>}</time></div>
      <div className="forum-post-main">
        <Link className="forum-category-tag" href={forumHref({ category: category.id })}>{t(category.name)}</Link>
        {post.spoiler ? <ForumSpoiler>{content}</ForumSpoiler> : content}
        {detail && novel && <Link className="forum-related-novel" href={`/novels/${novel.id}`}><BookOpen size={16} /> {t("Đọc")} {novel.title}<ArrowRight size={15} /></Link>}
        <div className="forum-post-actions">
          <button type="button" className={`forum-action ${state.likes.includes(post.id) ? "is-liked" : ""}`} disabled={!ready} aria-label={t("Thích bài viết")} aria-pressed={state.likes.includes(post.id)} onClick={() => onLike(post.id)}><Heart size={18} fill={state.likes.includes(post.id) ? "currentColor" : "none"} /><span>{stats.likes}</span></button>
          <Link className="forum-action" href={`/forum/${post.id}#comments`} aria-label={t("Bình luận ({0})", [stats.comments])}><MessageCircle size={18} /><span>{stats.comments}</span></Link>
          <span className="forum-action forum-view-count" title={t("Lượt xem minh họa + một lượt mở trên trình duyệt này")} aria-label={t("{0} lượt xem", [stats.views])}><Eye size={18} /><span>{stats.views}</span></span>
          <button type="button" className={`forum-action forum-save ${state.saved.includes(post.id) ? "is-saved" : ""}`} disabled={!ready} aria-label={state.saved.includes(post.id) ? t("Bỏ lưu bài viết") : t("Lưu bài viết")} aria-pressed={state.saved.includes(post.id)} onClick={() => onSave(post.id)}><Bookmark size={18} fill={state.saved.includes(post.id) ? "currentColor" : "none"} /></button>
        </div>
        {account && post.authorId === LOCAL_AUTHOR && <div className="forum-own-actions"><button type="button" onClick={() => onEdit(post)}><Pencil size={14} /> {t("Chỉnh sửa")}</button><button type="button" onClick={() => onDelete(post.id)}><Trash2 size={14} /> {t("Xóa bài viết")}</button></div>}
      </div>
    </article>
  );
}
