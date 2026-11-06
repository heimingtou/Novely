"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getForumPosts, markForumViewed, removeForumPost, toggleForumFlag } from "@/lib/forum-model.mjs";
import ForumShell from "./ForumShell";
import ForumPost from "./ForumPost";
import ForumComments from "./ForumComments";
import PostComposer from "./PostComposer";
import { useForumStore } from "./useForumStore";

export default function ForumDetail({ postId }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, update, ready, failed] = useForumStore();
  const [composer, setComposer] = useState(null);
  const post = getForumPosts(state).find((post) => post.id === postId);
  useEffect(() => {
    if (ready && post) update((current) => markForumViewed(current, post.id));
  }, [ready, post, update]);
  return (
    <ForumShell detail state={state} ready={ready} failed={failed} onCompose={() => setComposer({})}>
      <Link className="forum-back-link" href="/forum"><ArrowLeft size={16} /> {t("Về cộng đồng")}</Link>
      <div className="forum-detail-card">
        {!post && !ready && <p className="forum-loading" role="status">{t("Đang tải cuộc trò chuyện…")}</p>}
        {!post && ready && <div className="forum-empty"><MessageCircle size={34} /><h2>{t("Không tìm thấy bài viết")}</h2><p>{t("Bài viết có thể đã bị xóa hoặc chỉ được lưu trên một trình duyệt khác.")}</p><Link className="forum-button" href="/forum">{t("Về cộng đồng")}</Link></div>}
        {post && <>
          <ForumPost key={post.id} detail post={post} state={state} ready={ready} onLike={(id) => update((current) => toggleForumFlag(current, "likes", id))} onSave={(id) => update((current) => toggleForumFlag(current, "saved", id))} onEdit={(post) => setComposer({ post })} onDelete={(id) => { update((current) => removeForumPost(current, id)); router.push("/forum?sort=latest"); }} />
          <ForumComments key={postId} postId={postId} state={state} update={update} ready={ready} />
        </>}
      </div>
      {composer && <PostComposer post={composer.post} onClose={() => setComposer(null)} onSaved={(id) => { setComposer(null); if (id !== postId) router.push(`/forum/${id}`); }} />}
    </ForumShell>
  );
}
