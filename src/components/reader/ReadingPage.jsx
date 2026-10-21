"use client";

import Link from "next/link";
import localFont from "next/font/local";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bookmark, BookmarkCheck, BookOpen, Check, ChevronDown, Highlighter, Settings2, X } from "lucide-react";
import { chapterHref } from "@/data/novels.mjs";
import { DEFAULT_SETTINGS, READER_FONTS, normalizeAnnotations, normalizeBookmarks, normalizePosition, normalizeSettings, readingPercent, textSegments } from "@/lib/reader-model.mjs";
import { useReaderStorage } from "./useReaderStorage";
import ChapterNavigation from "./ChapterNavigation";
import ReaderSettings from "./ReaderSettings";
import ReaderSpeech from "./ReaderSpeech";
import ReaderNotebook from "./ReaderNotebook";
import ReaderDiscussion from "./ReaderDiscussion";
import ReaderClippings from "./ReaderClippings";
import ReaderProgress from "./ReaderProgress";
import "./reader.css";

const EMPTY = [];
// Georgia hệ thống có thể thiếu glyph tiếng Việt. Tự host toàn bộ Noto Serif
// để không ghép dấu từ font khác hoặc phụ thuộc kết nối tới Google Fonts.
const readerSerif = localFont({
  src: "./fonts/NotoSerif-Variable.ttf",
  variable: "--font-reader-serif",
  weight: "100 900",
  style: "normal",
  display: "swap",
  fallback: ["Times New Roman", "serif"],
});
const readerVietnam = localFont({
  src: "./fonts/BeVietnamPro-Regular.ttf", variable: "--font-reader-vietnam",
  weight: "400", style: "normal", display: "swap", fallback: ["Arial", "sans-serif"],
});
const readerMontserrat = localFont({
  src: "./fonts/Montserrat-Variable.ttf", variable: "--font-reader-montserrat",
  weight: "100 900", style: "normal", display: "swap", fallback: ["Arial", "sans-serif"],
});
const FONTS = Object.fromEntries(READER_FONTS.map((font) => [font.value, font.family]));

function readingAnchor() {
  const speech = document.querySelector('.reader-speech[data-playing="true"]');
  const toolbarHeight = document.querySelector(".reader-toolbar")?.offsetHeight || 68;
  return Math.min(window.innerHeight * 0.45, Math.max(Math.min(160, window.innerHeight * 0.25), speech ? toolbarHeight + speech.offsetHeight + 16 : 0));
}

export default function ReadingPage({ novel, chapter }) {
  const chapterIndex = novel.chapters.findIndex((item) => item.number === chapter.number);
  const prefix = `novely:v1:${novel.id}`;
  const chapterKey = `${prefix}:chapter:${chapter.number}`;
  const validatePosition = useCallback((value) => normalizePosition(value, novel.chapters), [novel.chapters]);
  const validateBookmarks = useCallback((value) => normalizeBookmarks(value, chapter.paragraphs), [chapter.paragraphs]);
  const validateAnnotations = useCallback((value) => normalizeAnnotations(value, chapter.paragraphs), [chapter.paragraphs]);
  const [settings, setSettings, ready, storageFailed] = useReaderStorage("novely:v1:settings", DEFAULT_SETTINGS, normalizeSettings);
  const [savedPosition, savePosition] = useReaderStorage(`${chapterKey}:position`, null, validatePosition);
  const [, saveLastPosition] = useReaderStorage(`${prefix}:last-position`, null, validatePosition);
  const [bookmarks, setBookmarks] = useReaderStorage(`${chapterKey}:bookmarks`, EMPTY, validateBookmarks);
  const [annotations, setAnnotations] = useReaderStorage(`${chapterKey}:annotations`, EMPTY, validateAnnotations);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clippingsOpen, setClippingsOpen] = useState(false);
  const [location, setLocation] = useState({ index: 0, percent: 0 });
  const [selection, setSelection] = useState(null);
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const articleRef = useRef(null);
  const restored = useRef(false);
  const latestPosition = useRef(null);
  const reflowPosition = useRef(null);
  const settingsButton = useRef(null);
  const words = chapter.paragraphs.reduce((total, paragraph) => total + paragraph.text.split(/\s+/).length, 0);

  const scrollToPosition = useCallback((position) => {
    const element = document.getElementById(`paragraph-${position.paragraphId}`);
    if (!element) return;
    const anchor = readingAnchor();
    window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top + element.offsetHeight * position.fraction - anchor, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (!ready || restored.current) return;
    let canceled = false;
    let frame;
    // Đợi font và bố cục của route mới trước khi khôi phục vị trí.
    document.fonts.ready.then(() => {
      if (canceled) return;
      frame = requestAnimationFrame(() => {
        if (canceled) return;
        const hash = window.location.hash.slice(1);
        const hashParagraph = chapter.paragraphs.find((p) => `paragraph-${p.id}` === hash);
        if (hashParagraph) {
          scrollToPosition({ paragraphId: hashParagraph.id, fraction: 0 });
          window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
        }
        else if (savedPosition?.chapterNumber === chapter.number) scrollToPosition(savedPosition);
        restored.current = true;
        window.dispatchEvent(new Event("scroll"));
      });
    });
    return () => { canceled = true; cancelAnimationFrame(frame); };
  }, [ready, savedPosition, chapter, scrollToPosition]);

  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    let timer;
    function save() {
      if (!latestPosition.current || !restored.current) return;
      savePosition(latestPosition.current);
      saveLastPosition(latestPosition.current);
    }
    function measure() {
      frame = 0;
      if (!restored.current || !articleRef.current) return;
      const elements = [...articleRef.current.querySelectorAll("[data-reader-paragraph]")];
      const anchor = readingAnchor();
      let index = elements.findIndex((element) => element.getBoundingClientRect().bottom > anchor);
      if (index === -1) index = elements.length - 1;
      const rect = elements[index].getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (anchor - rect.top) / Math.max(1, rect.height)));
      const percent = readingPercent(index, fraction, elements.length);
      latestPosition.current = { chapterNumber: chapter.number, paragraphId: chapter.paragraphs[index].id, fraction, percent };
      setLocation((current) => current.index === index && current.percent === percent ? current : { index, percent });
      clearTimeout(timer);
      timer = setTimeout(save, 250);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(measure); }
    function flush() { measure(); clearTimeout(timer); save(); }
    function onVisibility() { if (document.visibilityState === "hidden") flush(); }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      save();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready, chapter, savePosition, saveLastPosition]);

  useEffect(() => {
    if (!reflowPosition.current) return;
    let canceled = false;
    let frame;
    document.fonts.ready.then(() => {
      if (canceled) return;
      frame = requestAnimationFrame(() => {
        if (!reflowPosition.current) return;
        scrollToPosition(reflowPosition.current);
        reflowPosition.current = null;
      });
    });
    return () => { canceled = true; cancelAnimationFrame(frame); };
  }, [settings, scrollToPosition]);

  const jumpToParagraph = useCallback((id) => {
    scrollToPosition({ paragraphId: id, fraction: 0 });
    document.getElementById(`paragraph-${id}`)?.focus({ preventScroll: true });
  }, [scrollToPosition]);
  const onSpokenParagraph = useCallback((index) => jumpToParagraph(chapter.paragraphs[index].id), [chapter.paragraphs, jumpToParagraph]);

  function toggleBookmark(id) {
    setBookmarks((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setNotice(bookmarks.includes(id) ? "Đã bỏ đánh dấu đoạn văn." : "Đã đánh dấu đoạn văn trong sổ tay.");
  }

  const captureSelection = useCallback(() => {
    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.isCollapsed || browserSelection.rangeCount !== 1) { setSelection(null); return; }
    const range = browserSelection.getRangeAt(0);
    const getParagraph = (node) => (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest("[data-reader-paragraph]");
    const startParagraph = getParagraph(range.startContainer);
    const endParagraph = getParagraph(range.endContainer);
    if (!startParagraph || startParagraph !== endParagraph || !articleRef.current.contains(startParagraph)) {
      setSelection(null);
      setNotice("Hãy chọn văn bản trong một đoạn để tô sáng hoặc ghi chú.");
      return;
    }
    const prefixRange = range.cloneRange();
    prefixRange.selectNodeContents(startParagraph);
    prefixRange.setEnd(range.startContainer, range.startOffset);
    const start = prefixRange.toString().length;
    const text = range.toString();
    if (!text.trim()) return;
    setSelection({ paragraphId: startParagraph.dataset.readerParagraph, start, end: start + text.length, quote: text });
    setNote("");
    setNotice("");
  }, []);

  useEffect(() => {
    let timer;
    function onSelectionChange() {
      // Tay nắm chọn chữ trên điện thoại không luôn phát pointerup trong đoạn.
      // Không ghi đè bản nháp khi người đọc đang nhập ghi chú vào textarea.
      if (document.activeElement?.matches("input, textarea, select")) return;
      const current = window.getSelection();
      if (current?.isCollapsed || !articleRef.current?.contains(current?.anchorNode)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!document.activeElement?.matches("input, textarea, select")) captureSelection();
      }, 160);
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => { clearTimeout(timer); document.removeEventListener("selectionchange", onSelectionChange); };
  }, [captureSelection]);

  function addAnnotation(withNote) {
    if (!selection) return;
    if (annotations.some((item) => item.paragraphId === selection.paragraphId && item.start < selection.end && selection.start < item.end)) {
      setNotice("Vùng này đã có highlight. Bạn có thể sửa ghi chú trong My Clipping hoặc chọn phần văn bản khác.");
      return;
    }
    setAnnotations((current) => [...current, { ...selection, id: crypto.randomUUID(), note: withNote ? note.trim() : "" }]);
    setSelection(null);
    setNote("");
    window.getSelection()?.removeAllRanges();
    setNotice(withNote ? "Đã lưu highlight và ghi chú vào My Clipping." : "Đã highlight và tự động lưu vào My Clipping.");
  }

  return (
    <div className={`novely-reader ${readerSerif.variable} ${readerVietnam.variable} ${readerMontserrat.variable}`} data-theme={settings.theme} style={{ "--reader-width": `${settings.width}px`, "--reader-font": FONTS[settings.font], "--reader-size": `${settings.fontSize}px`, "--reader-leading": settings.lineHeight }} lang="vi" onKeyDown={(event) => {
      if (event.target.closest("dialog")) return;
      if (event.key === "Escape") { setSelection(null); setSettingsOpen(false); settingsButton.current?.focus(); }
    }}>
      <div className="reader-toolbar">
        <Link href={`/novels/${novel.id}`} className="reader-back"><ArrowLeft size={18} /><span>{novel.title}</span></Link>
        <div className="reader-toolbar-actions">
          <button type="button" className="reader-button" aria-label="My Clipping" onClick={() => { setSelection(null); setSettingsOpen(false); setClippingsOpen(true); }}><Highlighter size={18} /><span>My Clipping</span></button>
          <button type="button" disabled={!ready} className="reader-icon-button" aria-label="Đánh dấu đoạn đang đọc" aria-pressed={bookmarks.includes(chapter.paragraphs[location.index].id)} onClick={() => toggleBookmark(chapter.paragraphs[location.index].id)}><Bookmark size={19} /></button>
          <button ref={settingsButton} type="button" disabled={!ready} className={`reader-button ${settingsOpen ? "is-selected" : ""}`} aria-label="Cài đặt đọc" aria-expanded={settingsOpen} aria-controls="reader-settings" onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={18} /><span>Cài đặt đọc</span></button>
        </div>
        {settingsOpen && <ReaderSettings settings={settings} onChange={(next) => { reflowPosition.current = latestPosition.current; setSettings(next); }} onClose={() => { setSettingsOpen(false); settingsButton.current?.focus(); }} />}
      </div>

      <div className="reader-shell">
        {storageFailed && <p className="reader-warning" role="alert">Trình duyệt không cho phép lưu dữ liệu hoặc đã hết dung lượng. Thay đổi mới chỉ được giữ trong phiên này.</p>}
        <header className="reader-heading">
          <span className="reader-eyebrow"><BookOpen size={15} /> THƯ VIỆN CỦA NHỮNG CÂU CHUYỆN</span>
          <Link className="reader-novel-title" href={`/novels/${novel.id}`}>{novel.title}</Link>
          <h1><span>Chương {chapter.number}</span>{chapter.title}</h1>
          <p className="reader-meta">{novel.author}<span aria-hidden="true">·</span>{chapter.date}<span aria-hidden="true">·</span>Khoảng {Math.max(1, Math.ceil(words / 200))} phút đọc</p>
          <details className="reader-chapter-picker"><summary>Chọn chương <ChevronDown size={15} /></summary><nav aria-label="Chọn chương">{novel.chapters.map((item) => <Link key={item.number} href={chapterHref(novel.id, item.number)} aria-current={item.number === chapter.number ? "page" : undefined}>Chương {item.number}: {item.title}</Link>)}</nav></details>
        </header>

        <ChapterNavigation novelId={novel.id} previous={novel.chapters[chapterIndex - 1]} next={novel.chapters[chapterIndex + 1]} label="Điều hướng đầu chương" />
        <ReaderSpeech paragraphs={chapter.paragraphs} startIndex={location.index} onParagraph={onSpokenParagraph} />
        <div className="reader-status"><span><Check size={14} /> {storageFailed ? "Vị trí đang được giữ trong phiên này" : ready ? "Tự lưu vị trí đọc trên trình duyệt" : "Đang tải thiết lập đọc…"}</span><button type="button" className="reader-text-button" onClick={() => setClippingsOpen(true)}>Mở My Clipping</button></div>
        <p className="reader-caption reader-selection-tip">Chọn văn bản → Highlight để tự động lưu vào My Clipping. Dùng bookmark bên lề để giữ lại một đoạn.</p>

        <article ref={articleRef} className="reader-prose" aria-label={`Nội dung chương ${chapter.number}`} style={{ filter: `brightness(${settings.brightness}%)` }} onPointerUp={captureSelection} onKeyUp={captureSelection}>
          {chapter.paragraphs.map((paragraph, index) => <div key={paragraph.id} className="reader-paragraph-row">
            <p id={`paragraph-${paragraph.id}`} data-reader-paragraph={paragraph.id} tabIndex={-1}>
              {textSegments(paragraph.text, annotations.filter((item) => item.paragraphId === paragraph.id)).map((segment, segmentIndex) => segment.annotation
                ? <mark key={segment.annotation.id} title={segment.annotation.note || "Highlight cá nhân"}>{segment.text}</mark>
                : <span key={`text-${segmentIndex}`}>{segment.text}</span>)}
            </p>
            <button type="button" disabled={!ready} className={`reader-paragraph-bookmark reader-icon-button ${bookmarks.includes(paragraph.id) ? "is-selected" : ""}`} aria-label={`Đánh dấu đoạn ${index + 1}`} aria-pressed={bookmarks.includes(paragraph.id)} onClick={() => toggleBookmark(paragraph.id)}>{bookmarks.includes(paragraph.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}</button>
          </div>)}
          <div className="reader-end" aria-label="Hết chương"><span />✦<span /></div>
        </article>

        <p className="reader-notice" role="status">{notice}</p>
        <ChapterNavigation novelId={novel.id} previous={novel.chapters[chapterIndex - 1]} next={novel.chapters[chapterIndex + 1]} label="Điều hướng cuối chương" />
        {chapterIndex === novel.chapters.length - 1 && <p className="reader-last-chapter">Bạn đã đến chương mới nhất. Hẹn gặp lại ở câu chuyện tiếp theo.</p>}
        <div id="reader-notebook"><ReaderNotebook paragraphs={chapter.paragraphs} bookmarks={bookmarks} annotations={annotations} onJump={jumpToParagraph} onBookmark={toggleBookmark} onAnnotations={setAnnotations} /></div>
        <ReaderDiscussion key={chapterKey} storageKey={chapterKey} chapterNumber={chapter.number} />
      </div>

      {settings.showProgress && <ReaderProgress percent={location.percent} />}
      {clippingsOpen && <ReaderClippings novel={novel} currentChapter={chapter.number} onJump={jumpToParagraph} onClose={() => setClippingsOpen(false)} />}

      {selection && <section className="reader-selection-panel reader-panel" aria-label="Tô sáng và ghi chú văn bản đã chọn">
        <div className="reader-section-heading"><strong><Highlighter size={17} /> Highlight đoạn văn</strong><button type="button" className="reader-icon-button" aria-label="Đóng văn bản đã chọn" onClick={() => setSelection(null)}><X size={18} /></button></div>
        <blockquote>{selection.quote}</blockquote>
        <p className="reader-caption">Highlight sẽ tự động được thêm vào My Clipping.</p>
        <form onSubmit={(event) => { event.preventDefault(); if (note.trim()) addAnnotation(true); }}>
          <label className="reader-sr-only" htmlFor="selection-note">Ghi chú cho văn bản đã chọn</label><textarea id="selection-note" rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thêm ghi chú cá nhân (không bắt buộc)…" />
          <div className="reader-selection-actions"><button type="button" className="reader-button" aria-label="Tô sáng" onClick={() => addAnnotation(false)}><Highlighter size={16} /> Highlight</button><button type="submit" className="reader-button reader-button-primary" disabled={!note.trim()}>Lưu ghi chú</button></div>
          {notice && <p className="reader-caption" role="status">{notice}</p>}
        </form>
      </section>}
    </div>
  );
}
