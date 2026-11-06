
import { getServerI18n } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import ReadingPage from "@/components/reader/ReadingPage";
import { getChapter, getNovel } from "@/data/novels.mjs";

export async function generateMetadata({ params }) {
  const { t, locale } = await getServerI18n();
  const { id, chapterNumber } = await params;
  const novel = getNovel(id);
  const chapter = getChapter(novel, chapterNumber);
  return { title: chapter ? `${t("Chương {0}: {1}", [chapter.number, chapter.title])} · ${novel.title} | Novely` : t("Không tìm thấy chương | Novely") };
}

export default async function ChapterPage({ params }) {
  const { id, chapterNumber } = await params;
  const novel = getNovel(id);
  const chapter = getChapter(novel, chapterNumber);
  if (!novel || !chapter) notFound();
  return <ReadingPage key={`${id}-${chapter.number}`} novel={novel} chapter={chapter} />;
}
