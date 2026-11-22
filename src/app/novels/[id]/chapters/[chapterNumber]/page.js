
import { getServerI18n } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import ReadingPage from "@/components/reader/ReadingPage";
import { getReaderData } from "@/server/services/catalog";

export async function generateMetadata({ params }) {
  const { t } = await getServerI18n();
  const { id, chapterNumber } = await params;
  const data = await getReaderData(id, chapterNumber);
  if (!data) return { title: t("Không tìm thấy chương | Novely") };
  const { novel, chapter } = data;
  return { title: `${t("Chương {0}: {1}", [chapter.number, chapter.title])} · ${novel.title} | Novely` };
}

export default async function ChapterPage({ params }) {
  const { id, chapterNumber } = await params;
  const data = await getReaderData(id, chapterNumber);
  if (!data) notFound();
  const { novel, chapter } = data;
  return <ReadingPage key={`${novel.id}-${chapter.number}`} novel={novel} chapter={chapter} />;
}
