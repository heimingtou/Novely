"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import { useState } from "react";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { addForumComment, COMMENT_LIMIT, getForumComments, LOCAL_AUTHOR, removeForumComment } from "@/lib/forum-model.mjs";
import { ForumAvatar } from "./ForumIcons";
import { ForumSpoiler } from "./ForumPost";

export default function ForumComments({ postId, state, update, ready }) {
  const { t, locale } = useI18n();
  const comments = getForumComments(state, postId);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = { authorName: String(data.get("name") || "").trim(), body: String(data.get("comment") || "").trim(), spoiler: data.get("spoiler") === "on" };
    if (!input.authorName || !input.body) { setError(t("Vui lòng nhập tên và nội dung bình luận.")); return; }
    const id = `comment-${crypto.randomUUID()}`;
    const next = update((current) => addForumComment(current, postId, input, id, new Date().toISOString()));
    if (!next.comments[postId]?.some((comment) => comment.id === id)) { setError(t("Không thể lưu bình luận. Mỗi bài nhận tối đa 100 bình luận trên thiết bị này.")); return; }
    form.elements.comment.value = "";
    form.elements.spoiler.checked = false;
    setError(""); setNotice(t("Đã lưu bình luận trên trình duyệt này."));
  }
  return (
    <section id="comments" className="forum-comments" aria-labelledby="forum-comments-title">
      <div className="forum-section-heading"><h2 id="forum-comments-title"><MessageCircle size={19} /> {t("Cuộc trò chuyện")}</h2><span className="forum-count">{comments.length}</span></div>
      <form className="forum-form forum-comment-form" onSubmit={submit}>
        <label>{t("Tên hiển thị")}<input name="name" required maxLength={40} defaultValue={state.profile.name} autoComplete="nickname" /></label>
        <label>{t("Bình luận của bạn")}<textarea name="comment" required rows={3} maxLength={2000} placeholder={t("Thêm một góc nhìn cho cuộc trò chuyện…")} /></label>
        <div className="forum-comment-controls"><label className="forum-checkbox"><input type="checkbox" name="spoiler" /> {t("Bình luận có spoiler")}</label><button type="submit" className="forum-button forum-primary" disabled={!ready || (state.comments[postId] || []).length >= COMMENT_LIMIT}><Send size={16} /> {t("Gửi bình luận")}</button></div>
        {error && <p className="forum-error" role="alert">{t(error)}</p>}
      </form>
      <p className="forum-status" role="status">{t(notice)}</p>
      {!comments.length && <p className="forum-empty-comment">{t("Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện!")}</p>}
      <div className="forum-comment-list">{comments.map((comment) => <article className="forum-comment" key={comment.id}>
        <ForumAvatar name={comment.authorName} small />
        <div className="forum-comment-main"><div className="forum-comment-author"><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(comment.createdAt))}</time></div>
          {comment.spoiler ? <ForumSpoiler label={t("Bình luận có spoiler")}><p>{comment.body}</p></ForumSpoiler> : <p>{comment.body}</p>}
          {comment.authorId === LOCAL_AUTHOR && <button type="button" className="forum-delete-comment" aria-label={t("Xóa bình luận của tôi")} onClick={() => { update((current) => removeForumComment(current, postId, comment.id)); setNotice(t("Đã xóa bình luận.")); }}><Trash2 size={13} /> {t("Xóa")}</button>}
        </div>
      </article>)}</div>
    </section>
  );
}
