
import { getServerI18n } from "@/lib/i18n/server";
import ForumDetail from "@/components/forum/ForumDetail";
import { FORUM_POSTS } from "@/data/forum.mjs";

export async function generateMetadata({ params }) {
  const { t, locale } = await getServerI18n();
  const { postId } = await params;
  const post = FORUM_POSTS.find((post) => post.id === postId);
  return { title: `${post && !post.spoiler ? post.title : t("Thảo luận cộng đồng")} | Novely` };
}

export default async function ForumPostPage({ params }) {
  const { postId } = await params;
  return <ForumDetail key={postId} postId={postId} />;
}
