import { notFound } from "next/navigation";
import WriterNovelDetail from "@/components/novel-detail/WriterNovelDetail";
import { requireUser } from "@/server/auth/dal";
import { ApiError } from "@/server/http";
import { getMyNovel, listGenreOptions } from "@/server/services/writer";

export const metadata = { title: "Quản lý truyện | Novely" };

export default async function WriterNovelPage({ params }) {
  const { id } = await params;
  const user = await requireUser(`/Writer/novels/${id}`);
  let novel;
  try {
    novel = await getMyNovel(user, id);
  } catch (error) {
    // Không tiết lộ truyện của người khác có tồn tại hay không: 403 cũng hiển thị 404.
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  return <WriterNovelDetail novel={novel} genres={await listGenreOptions()} />;
}
