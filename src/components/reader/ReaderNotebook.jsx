"use client";

import { Bookmark, Highlighter, Trash2 } from "lucide-react";
import { useState } from "react";

export default function ReaderNotebook({ paragraphs, bookmarks, annotations, onJump, onBookmark, onAnnotations }) {
  const [notice, setNotice] = useState("");
  return (
    <section className="reader-panel reader-notebook" aria-labelledby="notebook-heading">
      <span className="reader-eyebrow">DÀNH RIÊNG CHO BẠN</span>
      <h2 id="notebook-heading">Sổ tay chương này</h2>
      <p className="reader-caption">Bookmark, highlight và ghi chú cá nhân được lưu trên trình duyệt này.</p>
      <details>
        <summary><Bookmark size={17} /> Vị trí đã đánh dấu <span className="reader-count">{bookmarks.length}</span></summary>
        {!bookmarks.length && <p className="reader-empty">Bấm biểu tượng bookmark bên cạnh đoạn văn để đánh dấu.</p>}
        {bookmarks.map((id) => <div className="reader-bookmark-item" key={id}>
          <button type="button" className="reader-text-button" onClick={() => onJump(id)}>{paragraphs.find((p) => p.id === id)?.text.slice(0, 110)}…</button>
          <button type="button" className="reader-icon-button" aria-label={`Bỏ đánh dấu đoạn ${paragraphs.findIndex((p) => p.id === id) + 1}`} onClick={() => onBookmark(id)}><Trash2 size={16} /></button>
        </div>)}
      </details>
      <details>
        <summary><Highlighter size={17} /> My Clipping · Chương này <span className="reader-count">{annotations.length}</span></summary>
        {!annotations.length && <p className="reader-empty">Bôi chọn một phần văn bản trong một đoạn để tô sáng hoặc thêm ghi chú.</p>}
        {annotations.map((annotation) => <div key={annotation.id} className="reader-note">
          <div className="reader-section-heading"><button type="button" className="reader-text-button" onClick={() => onJump(annotation.paragraphId)}>“{annotation.quote}”</button><button type="button" className="reader-icon-button" aria-label="Xóa highlight và ghi chú" onClick={() => onAnnotations((current) => current.filter((item) => item.id !== annotation.id))}><Trash2 size={16} /></button></div>
          <form onSubmit={(event) => { event.preventDefault(); const note = String(new FormData(event.currentTarget).get("note") || "").trim(); onAnnotations((current) => current.map((item) => item.id === annotation.id ? { ...item, note } : item)); setNotice("Đã lưu ghi chú cá nhân."); }}>
            <label>Ghi chú cá nhân<textarea key={`${annotation.id}-${annotation.note}`} name="note" maxLength={1000} rows={2} defaultValue={annotation.note} placeholder="Viết suy nghĩ của bạn…" /></label>
            <button type="submit" className="reader-button">Lưu ghi chú</button>
          </form>
        </div>)}
      </details>
      <p className="reader-caption" role="status">{notice}</p>
    </section>
  );
}
