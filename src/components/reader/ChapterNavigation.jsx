"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, List } from "lucide-react";
import { chapterHref } from "@/data/novels.mjs";
import { ChapterOptions } from "./ChapterPicker";

export default function ChapterNavigation({ novelId, chapters, currentChapter, previous, next, label }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <nav className="reader-chapter-nav" aria-label={label}>
      <div className="reader-chapter-nav-controls">
      {previous ? <Link className="reader-button" href={chapterHref(novelId, previous.number)}><ArrowLeft size={17} /><span>{t("Chương trước")}</span></Link>
        : <button className="reader-button" type="button" disabled><ArrowLeft size={17} /><span>{t("Chương trước")}</span></button>}
      <button type="button" className="reader-button reader-chapter-trigger" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><List size={17} /><span>{t("Danh sách chương")}</span><ChevronDown size={15} className="reader-chapter-chevron" /></button>
      {next ? <Link className="reader-button" href={chapterHref(novelId, next.number)}><span>{t("Chương sau")}</span><ArrowRight size={17} /></Link>
        : <button className="reader-button" type="button" disabled><span>{t("Chương sau")}</span><ArrowRight size={17} /></button>}
      </div>
      {open && <ChapterOptions id={id} novelId={novelId} chapters={chapters} currentChapter={currentChapter} onSelect={() => setOpen(false)} />}
    </nav>
  );
}
