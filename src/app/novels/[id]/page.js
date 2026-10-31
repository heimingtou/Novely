
import { getServerI18n } from "@/lib/i18n/server";

import ChapterList from "@/components/novel-detail/ChapterList";
import NovelActions from "@/components/novel-detail/NovelActions";
import ResumeReading from "@/components/novel-detail/ResumeReading";
import WriterNovelDetail from "@/components/novel-detail/WriterNovelDetail";
import { getNovel } from "@/data/novels.mjs";

// Component chính của trang
export default async function NovelDetailPage({ params }) {
  const { t, locale } = await getServerI18n();
  const { id } = await params;
  const novel = getNovel(id);
  if (!novel) return <WriterNovelDetail novelId={id} />;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10" lang={locale}>

      <h1 className="mb-6 text-3xl font-bold">{t("Chi tiết truyện")} </h1>

      {/* Thông tin truyện */}
      <section className="grid gap-8 rounded-2xl border border-border bg-card p-6 md:grid-cols-[200px_1fr]">

        {/* Bìa truyện */}
        <div className="flex h-72 items-center justify-center rounded-xl bg-gradient-to-br from-purple-800 to-pink-500 text-6xl text-white">
          ✦
        </div>

        {/* Tên và mô tả */}
        <div>
          <h2 className="text-2xl font-bold">
            {novel.title}
          </h2>

          <p className="mt-2">{t("Tác giả:")} {novel.author}
          </p>

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
                {tag}
              </span>
            ))}
          </div>

          {/* Thống kê */}
          <div className="mt-5 flex gap-6">
            <p>⭐ {novel.rating}/5</p>
            <p>👁 {novel.views} {t("lượt xem")}</p>
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
