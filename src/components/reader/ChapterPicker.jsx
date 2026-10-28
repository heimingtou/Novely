"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import Link from "next/link";
import { Check } from "lucide-react";
import { chapterHref } from "@/data/novels.mjs";

export function ChapterOptions({ id, novelId, chapters, currentChapter, onSelect }) {
  const { t } = useI18n();
  return (
    <ul id={id} className="reader-chapter-options" aria-label={t("Các chương trong truyện")}>
      {chapters.map((item) => <li key={item.number}>
        <Link href={chapterHref(novelId, item.number)} aria-current={item.number === currentChapter ? "page" : undefined} onClick={onSelect}>
          <span>{t("Chương")} {item.number}: {item.title}</span>
          {item.number === currentChapter && <Check size={17} aria-label={t("Đang đọc")} />}
        </Link>
      </li>)}
    </ul>
  );
}

