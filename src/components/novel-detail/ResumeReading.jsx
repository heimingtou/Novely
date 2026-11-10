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
      <Link className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FF5454] px-4 font-semibold text-white transition hover:opacity-90 sm:w-60" href={`${chapterHref(novel.id, novel.chapters[0].number)}#paragraph-${novel.chapters[0].paragraphs[0].id}`}><BookOpen size={18} /> {t("Đọc từ đầu")}</Link>
      {position && (
        <Link
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FF5454] px-4 font-semibold text-white transition hover:opacity-90 sm:w-60"
          href={chapterHref(novel.id, position.chapterNumber)}
        >
          <History size={20} />
          {t("Đọc tiếp chương")} {position.chapterNumber}
        </Link>
      )}   </div>
  );
}
