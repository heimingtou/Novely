import { notFound } from "next/navigation";
import ReadingPage from "@/components/reader/ReadingPage";
import { getChapter, getNovel } from "@/data/novels.mjs";

export async function generateMetadata({ params }) {
  const { id, chapterNumber } = await params;
  const novel = getNovel(id);
  const chapter = getChapter(novel, chapterNumber);
  return { title: chapter ? `Chương ${chapter.number}: ${chapter.title} · ${novel.title} | Novely` : "Không tìm thấy chương | Novely" };
}

export default async function ChapterPage({ params }) {
  const { id, chapterNumber } = await params;
  const novel = getNovel(id);
  const chapter = getChapter(novel, chapterNumber);
  if (!novel || !chapter) notFound();
  return <ReadingPage key={`${id}-${chapter.number}`} novel={novel} chapter={chapter} />;
}
