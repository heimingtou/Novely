import { SearchIcon } from "lucide-react";
import { getServerI18n } from "@/lib/i18n/server";
import ListStory from "@/components/ListStory/ListStory";
import { searchNovels } from "@/server/services/catalog";
import "./page.css";

// Tìm theo tiêu đề trên server: /search?q=kiếm. Form GET nên chạy được cả khi chưa tải JS.
export default async function SearchPage({ searchParams }) {
  const { t } = await getServerI18n();
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q ?? "").trim().slice(0, 100);
  const results = await searchNovels(query, { limit: query ? 50 : 5 });

  return <div>
    <form className="containtSearch" role="search" action="/search">
      <input type="search" name="q" aria-label={t("Tìm kiếm")} placeholder={t("search story")} defaultValue={query} />
      <button type="submit" className="btn_searchBar" aria-label={t("Tìm kiếm")}><SearchIcon color="white" /></button>
    </form>
    <div className="resultSearch">
      <ListStory title={query ? t("Kết quả tìm kiếm cho “{0}”", [query]) : t("Đề xuất truyện")} DataStory={results} />
      {query && !results.length && <p className="px-6 py-10 text-center text-muted">{t("Không tìm thấy truyện phù hợp.")}</p>}
    </div>
  </div>;
}
