import ForumFeed from "@/components/forum/ForumFeed";
import { getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerI18n();
  return { title: t("Cộng đồng đọc truyện | Novely"), description: t("Thảo luận truyện, chia sẻ giả thuyết và kết nối cùng cộng đồng độc giả Novely.") };
}

export default async function ForumPage({ searchParams }) {
  const params = await searchParams;
  return <ForumFeed params={params} />;
}
