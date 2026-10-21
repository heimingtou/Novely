import Link from "next/link";
import { ArrowLeft, ArrowRight, List } from "lucide-react";
import { chapterHref } from "@/data/novels.mjs";

export default function ChapterNavigation({ novelId, previous, next, label }) {
  return (
    <nav className="reader-chapter-nav" aria-label={label}>
      {previous ? <Link className="reader-button" href={chapterHref(novelId, previous.number)}><ArrowLeft size={17} /><span>Chương trước</span></Link>
        : <button className="reader-button" type="button" disabled><ArrowLeft size={17} /><span>Chương trước</span></button>}
      <Link className="reader-button" href={`/novels/${novelId}#chapters`}><List size={17} /><span>Danh sách chương</span></Link>
      {next ? <Link className="reader-button" href={chapterHref(novelId, next.number)}><span>Chương sau</span><ArrowRight size={17} /></Link>
        : <button className="reader-button" type="button" disabled><span>Chương sau</span><ArrowRight size={17} /></button>}
    </nav>
  );
}
