import CreateNovelFlow from "@/components/Writer/CreateNovelFlow";
import { requireUser } from "@/server/auth/dal";
import { ApiError } from "@/server/http";
import { getMyChapter, getMyNovel, listGenreOptions } from "@/server/services/writer";

export const metadata = { title: "Câu truyện của bạn | Novely" };

// /Writer/new                         -> tạo truyện mới
// /Writer/new?novelId=1               -> thêm chương cho truyện 1
// /Writer/new?novelId=1&chapterId=9   -> sửa chương 9
export default async function NewNovelPage({ searchParams }) {
  const { novelId, chapterId } = await searchParams;
  const query = new URLSearchParams({ ...(typeof novelId === "string" && { novelId }), ...(typeof chapterId === "string" && { chapterId }) });
  const user = await requireUser(`/Writer/new${query.size ? `?${query}` : ""}`);

  let novel = null;
  let chapter = null;
  let loadError = "";
  try {
    if (typeof novelId === "string" && novelId) novel = await getMyNovel(user, novelId);
    if (novel && typeof chapterId === "string" && chapterId) chapter = await getMyChapter(user, novel.id, chapterId);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    loadError = error.status === 403 ? error.message : chapterId ? "Không tìm thấy chương cần sửa." : "Không tìm thấy truyện cần thêm chapter.";
  }

  return (
    <CreateNovelFlow
      key={`${novel?.id ?? "new"}-${chapter?.id ?? "new"}`}
      genres={await listGenreOptions()}
      novel={novel}
      chapter={chapter}
      loadError={loadError}
    />
  );
}
