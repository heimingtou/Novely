"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import { useState } from "react";
import { Heart, LogIn, MessageCircle, Send, ThumbsUp, Trash2, UserRound } from "lucide-react";
import { normalizeComments, normalizeReaction } from "@/lib/reader-model.mjs";
import { useDemoSession } from "@/lib/useDemoSession";
import { useReaderStorage } from "./useReaderStorage";

const EMPTY = [];
const REACTIONS = [{ id: "love", label: "Yêu thích", icon: Heart }, { id: "like", label: "Hay quá", icon: ThumbsUp }, { id: "wow", label: "Bất ngờ", emoji: "✦" }];

export default function ReaderDiscussion({ storageKey }) {
  const { t, locale } = useI18n();
  const { account, ready: sessionReady, signIn } = useDemoSession();
  const [comments, setComments, ready] = useReaderStorage(`${storageKey}:comments`, EMPTY, normalizeComments);
  const [reaction, setReaction] = useReaderStorage(`${storageKey}:reaction`, null, normalizeReaction);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!account) { setError(t("Vui lòng đăng nhập để bình luận.")); return; }
    const name = account.name;
    const text = String(data.get("comment") || "").trim();
    if (!text) { setError(t("Vui lòng nhập nội dung bình luận.")); return; }
    setComments((current) => [{ id: crypto.randomUUID(), name, text, date: new Date().toISOString() }, ...current].slice(0, 100));
    form.elements.comment.value = "";
    setError("");
    setNotice(t("Đã lưu bình luận trên trình duyệt này."));
  }
  return (
    <section id="chapter-discussion" className="reader-panel reader-discussion" aria-labelledby="discussion-heading">
      <div className="reader-reaction-section">
        <span className="reader-eyebrow">{t("GẤP LẠI MỘT TRANG SÁCH")}</span>
        <h2>{t("Bạn thấy chương này thế nào?")}</h2>
        <div className="reader-reactions">{REACTIONS.map(({ id, label, icon: Icon, emoji }) => (
          <button type="button" key={id} disabled={!ready} aria-pressed={reaction === id} onClick={() => setReaction(reaction === id ? null : id)} className={`reader-button ${reaction === id ? "is-selected" : ""}`}>
            {Icon ? <Icon size={18} /> : <span aria-hidden="true">{emoji}</span>}{t(label)}
          </button>
        ))}</div>
        <p className="reader-caption" aria-live="polite">{reaction ? t("Đã lưu cảm xúc của bạn trên thiết bị này.") : t("Chọn một cảm xúc dành cho chương truyện.")}</p>
      </div>
      <div className="reader-section-heading"><h2 id="discussion-heading"><MessageCircle size={21} /> {t("Bình luận")}</h2><span className="reader-count">{comments.length}</span></div>
      <p className="reader-caption">{t("Bản demo: bình luận và cảm xúc chỉ lưu trên trình duyệt này, chưa chia sẻ với người đọc khác.")}</p>
      {account ? <form className="reader-comment-form" onSubmit={submit}>
        <p className="reader-comment-account"><UserRound size={17} /><span>{t("Bình luận với tài khoản")} <strong>{account.name}</strong></span></p>
        <label>{t("Cảm nghĩ của bạn")}<textarea name="comment" required maxLength={1500} rows={3} placeholder={t("Chia sẻ đôi điều về chương này…")} /></label>
        {error && <p role="alert">{t(error)}</p>}
        <div className="reader-comment-footer"><span className="reader-caption">{t("Tối đa 1.500 ký tự")}</span><button type="submit" className="reader-button reader-button-primary" disabled={!ready}><Send size={16} /> {t("Gửi bình luận")}</button></div>
      </form> : <div className="reader-comment-login">
        <p className="reader-caption">{t("Đăng nhập để chia sẻ cảm nghĩ của bạn.")}</p>
        <button type="button" className="reader-button reader-button-primary" disabled={!ready || !sessionReady} onClick={signIn}><LogIn size={17} /> {t("Đăng nhập để bình luận")}</button>
      </div>}
      <p className="reader-caption" role="status">{t(notice)}</p>
      <div className="reader-comments">
        {!comments.length && <p className="reader-empty">{t("Chưa có bình luận trên thiết bị này. Hãy để lại cảm nghĩ đầu tiên.")}</p>}
        {comments.map((comment) => <article key={comment.id} className="reader-comment">
          <div className="reader-section-heading"><div><strong>{comment.name}</strong><time dateTime={comment.date}>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date(comment.date))}</time></div><button type="button" className="reader-icon-button" aria-label={t("Xóa bình luận của {0}", [comment.name])} onClick={() => { setComments((current) => current.filter((item) => item.id !== comment.id)); setNotice(t("Đã xóa bình luận.")); }}><Trash2 size={16} /></button></div>
          <p>{comment.text}</p>
        </article>)}
      </div>
    </section>
  );
}
