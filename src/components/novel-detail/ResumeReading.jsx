"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import Link from "next/link";
import { useCallback } from "react";
import { BookOpen, History } from "lucide-react";
import { chapterHref } from "@/data/novels.mjs";
import { normalizePosition } from "@/lib/reader-model.mjs";
import { useReaderStorage } from "@/components/reader/useReaderStorage";

export default function ResumeReading({ novel }) {
  const { t } = useI18n();
  const validate = useCallback((value) => normalizePosition(value, novel.chapters), [novel.chapters]);
  const [position] = useReaderStorage(`novely:v1:${novel.id}:last-position`, null, validate);
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:opacity-90" href={`${chapterHref(novel.id, novel.chapters[0].number)}#paragraph-${novel.chapters[0].paragraphs[0].id}`}><BookOpen size={18} /> {t("Đọc từ đầu")}</Link>
      {position && <Link className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-semibold hover:bg-secondary-bg" href={chapterHref(novel.id, position.chapterNumber)}><History size={18} /> {t("Đọc tiếp chương")} {position.chapterNumber}</Link>}
    </div>
  );
}
