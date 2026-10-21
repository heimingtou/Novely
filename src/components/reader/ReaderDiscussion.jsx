"use client";

import { useState } from "react";
import { Heart, MessageCircle, Send, ThumbsUp, Trash2 } from "lucide-react";
import { normalizeComments, normalizeReaction } from "@/lib/reader-model.mjs";
import { useReaderStorage } from "./useReaderStorage";

const EMPTY = [];
const REACTIONS = [{ id: "love", label: "Yêu thích", icon: Heart }, { id: "like", label: "Hay quá", icon: ThumbsUp }, { id: "wow", label: "Bất ngờ", emoji: "✦" }];

export default function ReaderDiscussion({ storageKey, chapterNumber }) {
  const [comments, setComments, ready] = useReaderStorage(`${storageKey}:comments`, EMPTY, normalizeComments);
  const [reaction, setReaction] = useReaderStorage(`${storageKey}:reaction`, null, normalizeReaction);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const text = String(data.get("comment") || "").trim();
    if (!name || !text) { setError("Vui lòng nhập tên và nội dung bình luận."); return; }
    setComments((current) => [{ id: crypto.randomUUID(), name, text, date: new Date().toISOString() }, ...current].slice(0, 100));
    form.elements.comment.value = "";
    setError("");
    setNotice("Đã lưu bình luận trên trình duyệt này.");
  }
  return (
    <section id="chapter-discussion" className="reader-panel reader-discussion" aria-labelledby="discussion-heading">
      <div className="reader-reaction-section">
        <span className="reader-eyebrow">GẤP LẠI MỘT TRANG SÁCH</span>
        <h2>Bạn thấy chương này thế nào?</h2>
        <div className="reader-reactions">{REACTIONS.map(({ id, label, icon: Icon, emoji }) => (
          <button type="button" key={id} disabled={!ready} aria-pressed={reaction === id} onClick={() => setReaction(reaction === id ? null : id)} className={`reader-button ${reaction === id ? "is-selected" : ""}`}>
            {Icon ? <Icon size={18} /> : <span aria-hidden="true">{emoji}</span>}{label}
          </button>
        ))}</div>
        <p className="reader-caption" aria-live="polite">{reaction ? "Đã lưu cảm xúc của bạn trên thiết bị này." : "Chọn một cảm xúc dành cho chương truyện."}</p>
      </div>
      <div className="reader-section-heading"><h2 id="discussion-heading"><MessageCircle size={21} /> Bình luận chương {chapterNumber}</h2><span className="reader-count">{comments.length}</span></div>
      <p className="reader-caption">Bản demo: bình luận và cảm xúc chỉ lưu trên trình duyệt này, chưa chia sẻ với người đọc khác.</p>
      <form className="reader-comment-form" onSubmit={submit}>
        <label>Tên hiển thị<input name="name" required maxLength={40} autoComplete="nickname" placeholder="Tên của bạn" /></label>
        <label>Cảm nghĩ của bạn<textarea name="comment" required maxLength={1500} rows={3} placeholder="Chia sẻ đôi điều về chương này…" /></label>
        {error && <p role="alert">{error}</p>}
        <div className="reader-comment-footer"><span className="reader-caption">Tối đa 1.500 ký tự</span><button type="submit" className="reader-button reader-button-primary" disabled={!ready}><Send size={16} /> Gửi bình luận</button></div>
      </form>
      <p className="reader-caption" role="status">{notice}</p>
      <div className="reader-comments">
        {!comments.length && <p className="reader-empty">Chưa có bình luận trên thiết bị này. Hãy để lại cảm nghĩ đầu tiên.</p>}
        {comments.map((comment) => <article key={comment.id} className="reader-comment">
          <div className="reader-section-heading"><div><strong>{comment.name}</strong><time dateTime={comment.date}>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(comment.date))}</time></div><button type="button" className="reader-icon-button" aria-label={`Xóa bình luận của ${comment.name}`} onClick={() => { setComments((current) => current.filter((item) => item.id !== comment.id)); setNotice("Đã xóa bình luận."); }}><Trash2 size={16} /></button></div>
          <p>{comment.text}</p>
        </article>)}
      </div>
    </section>
  );
}
