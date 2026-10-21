"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Highlighter, Trash2, X } from "lucide-react";
import { chapterHref } from "@/data/novels.mjs";
import { normalizeAnnotations } from "@/lib/reader-model.mjs";
import { useReaderStorage } from "./useReaderStorage";

const EMPTY = [];

function ChapterClippings({ novelId, chapter, currentChapter, onJump, onClose }) {
  const validate = useCallback((value) => normalizeAnnotations(value, chapter.paragraphs), [chapter.paragraphs]);
  const [clippings, setClippings] = useReaderStorage(`novely:v1:${novelId}:chapter:${chapter.number}:annotations`, EMPTY, validate);
  const [notice, setNotice] = useState("");
  return (
    <section className="reader-clipping-chapter" aria-label={`Clipping chương ${chapter.number}`}>
      <h3>Chương {chapter.number}: {chapter.title}<span className="reader-count">{clippings.length}</span></h3>
      {!clippings.length && <p className="reader-empty">Chưa có trích đoạn được lưu trong chương này.</p>}
      {clippings.map((clipping) => <article className="reader-note" key={clipping.id}>
        <div className="reader-section-heading">
          {chapter.number === currentChapter
            ? <button type="button" className="reader-text-button" onClick={() => { onClose(); onJump(clipping.paragraphId); }}>“{clipping.quote}”</button>
            : <Link className="reader-text-button" href={`${chapterHref(novelId, chapter.number)}#paragraph-${clipping.paragraphId}`} onClick={onClose}>“{clipping.quote}”</Link>}
          <button type="button" className="reader-icon-button" aria-label="Xóa clipping" onClick={() => { setClippings((current) => current.filter((item) => item.id !== clipping.id)); setNotice("Đã xóa clipping và highlight tương ứng."); }}><Trash2 size={16} /></button>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          const note = String(new FormData(event.currentTarget).get("note") || "").trim();
          setClippings((current) => current.map((item) => item.id === clipping.id ? { ...item, note } : item));
          setNotice("Đã lưu ghi chú vào My Clipping.");
        }}>
          <label>Ghi chú cá nhân<textarea key={`${clipping.id}-${clipping.note}`} name="note" maxLength={1000} rows={2} defaultValue={clipping.note} placeholder="Thêm ghi chú cho trích đoạn…" /></label>
          <button type="submit" className="reader-button">Lưu ghi chú</button>
        </form>
      </article>)}
      <p className="reader-caption" role="status">{notice}</p>
    </section>
  );
}

export default function ReaderClippings({ novel, currentChapter, onJump, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  function close() { dialogRef.current.close(); onClose(); }
  return (
    <dialog ref={dialogRef} className="reader-clippings-dialog reader-panel" aria-labelledby="clippings-title" onCancel={(event) => { event.preventDefault(); close(); }}>
      <div className="reader-section-heading">
        <div><span className="reader-eyebrow">TRÍCH ĐOẠN CỦA BẠN</span><h2 id="clippings-title"><Highlighter size={21} /> My Clipping</h2></div>
        <button type="button" className="reader-icon-button" aria-label="Đóng My Clipping" onClick={close}><X size={20} /></button>
      </div>
      <p className="reader-clippings-novel">{novel.title}</p>
      <p className="reader-caption">Các đoạn highlight tự động được lưu vào đây. Bấm trích đoạn để đọc lại; dữ liệu chỉ lưu trên trình duyệt này.</p>
      {novel.chapters.map((chapter) => <ChapterClippings key={chapter.number} novelId={novel.id} chapter={chapter} currentChapter={currentChapter} onJump={onJump} onClose={close} />)}
    </dialog>
  );
}
