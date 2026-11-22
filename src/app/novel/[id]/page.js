
import { getServerI18n } from "@/lib/i18n/server";
import './page.css'
import ListStory from "@/components/ListStory/ListStory";
import { getGenrePage } from "@/server/services/catalog";

// Trang thể loại: /novel/:slug (hoặc tên thể loại, ví dụ /novel/Ngôn Tình).
export default async function GenrePage({ params }) {
  const { t } = await getServerI18n();
  const { id } = await params;
  const { genre, novels } = await getGenrePage(id);
  const title = genre ? t(genre.name) : t(decodeURIComponent(id));

  return (
    <div className="Containt">
      <ListStory title={title} DataStory={novels} />
      {!novels.length && <p className="px-6 py-10 text-center text-muted">{t("Chưa có truyện nào thuộc thể loại này.")}</p>}
    </div>
  );
}
