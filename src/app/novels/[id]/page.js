
import Image from "next/image";
import { getServerI18n } from "@/lib/i18n/server";

import ChapterList from "@/components/novel-detail/ChapterList";
import NovelActions from "@/components/novel-detail/NovelActions";
import ResumeReading from "@/components/novel-detail/ResumeReading";
import WriterNovelDetail from "@/components/novel-detail/WriterNovelDetail";
import { getNovelDetail } from "@/server/services/catalog";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const novel = await getNovelDetail(id);
  return novel ? { title: `${novel.title} | Novely`, description: novel.description } : {};
}

// Component chính của trang
export default async function NovelDetailPage({ params }) {
  const { t, locale } = await getServerI18n();
  const { id } = await params;
  const novel = await getNovelDetail(id);
  // Không có trong database: có thể là bản nháp người viết lưu trên trình duyệt.
  if (!novel) return <WriterNovelDetail novelId={id} />;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10" lang={locale}>

      <h1 className="mb-6 text-3xl font-bold">{t("Chi tiết truyện")} </h1>

      {/* Thông tin truyện */}
      <section className="grid gap-8 rounded-2xl border border-border bg-card p-6 md:grid-cols-[200px_1fr]">

        {/* Bìa truyện */}
        <div className="relative h-72 overflow-hidden rounded-xl bg-linear-to-br from-purple-800 to-pink-500">
          <Image src={novel.coverImage} alt={novel.title} fill sizes="200px" className="object-cover" priority />
        </div>

        {/* Tên và mô tả */}
        <div>
          <h2 className="text-2xl font-bold">
            {novel.title}
          </h2>

          <p className="mt-2">{t("Tác giả:")} {novel.author}</p>

          <p className="mt-5 leading-7">
            {novel.description}
          </p>

          {/* Thể loại */}
          <div className="mt-5 flex flex-wrap gap-2">
            {novel.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
              >
                {t(tag)}
              </span>
            ))}
          </div>

          {/* Thống kê */}
          <div className="mt-5 flex flex-wrap gap-6">
            <p>⭐ {novel.rating ?? "—"}/5 <span className="text-sm text-muted">({novel.reviewCount})</span></p>
            <p>👁 {novel.views} {t("lượt xem")}</p>
            <p>❤ {novel.likes}</p>
          </div>
        </div>
      </section>

      <ResumeReading novel={novel} />

      {/* Library và Share */}
      <NovelActions novelTitle={novel.title} />

      {/* Danh sách chương */}
      <ChapterList novelId={novel.id} chapters={novel.chapters} />

    </div>
  );
}
