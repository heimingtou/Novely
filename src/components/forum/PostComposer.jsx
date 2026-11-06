"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import { useState } from "react";
import { Send, ShieldAlert } from "lucide-react";
import { FORUM_CATEGORIES } from "@/data/forum.mjs";
import { novels } from "@/data/novels.mjs";
import { addForumPost, editForumPost, POST_LIMIT, validatePostInput } from "@/lib/forum-model.mjs";
import ForumDialog from "./ForumDialog";
import { useForumStore } from "./useForumStore";
import { useDemoSession } from "@/lib/useDemoSession";
import { ForumAccount, ForumSignIn } from "./ForumAccount";

export default function PostComposer({ post, category = "general", onClose, onSaved }) {
  const { t } = useI18n();
  const { account, signIn, ready: sessionReady } = useDemoSession();
  const [state, update, ready] = useForumStore();
  const [title, setTitle] = useState(post?.title || "");
  const [body, setBody] = useState(post?.body || "");
  const [errors, setErrors] = useState({});
  const limitReached = !post && state.posts.length >= POST_LIMIT;
  function submit(event) {
    event.preventDefault();
    if (!account) { setErrors({ account: "Vui lòng đăng nhập để đăng bài." }); return; }
    const form = new FormData(event.currentTarget);
    const input = { title, body, authorName: post?.authorName || account.name, category: String(form.get("category") || ""), novelId: String(form.get("novel") || "") || null, spoiler: form.get("spoiler") === "on" };
    const found = validatePostInput(input);
    if (Object.keys(found).length) { setErrors(found); return; }
    const id = post?.id || `post-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const next = update((current) => post ? editForumPost(current, id, input, now) : addForumPost(current, input, id, now));
    if (!next.posts.some((item) => item.id === id)) { setErrors({ submit: t("Không thể lưu bài. Thiết bị này đã đạt giới hạn bài viết demo.") }); return; }
    onSaved(id);
  }
  return (
    <ForumDialog title={post ? t("Chỉnh sửa bài viết") : t("Chia sẻ một câu chuyện")} onClose={onClose}>
      <p className="forum-muted">{t("Một câu hỏi, một góc nhìn hay một cuốn sách bạn muốn kể.")}</p>
      {account ? <form className="forum-form" onSubmit={submit}>
        <ForumAccount account={account} />
        <label>{t("Chủ đề")}<select name="category" aria-label={t("Chủ đề")} required defaultValue={post?.category || category}>{FORUM_CATEGORIES.map((item) => <option value={item.id} key={item.id}>{t(item.name)}</option>)}</select></label>
        <label>{t("Truyện liên quan")} <span className="forum-optional">{t("không bắt buộc")}</span><select name="novel" aria-label={t("Truyện liên quan")} defaultValue={post?.novelId || ""}><option value="">{t("Không gắn với truyện cụ thể")}</option>{novels.map((novel) => <option value={novel.id} key={novel.id}>{novel.title}</option>)}</select></label>
        <label>{t("Tiêu đề")}<input name="title" required maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("Bạn muốn cùng mọi người nói về điều gì?")} aria-invalid={Boolean(errors.title)} /></label>
        <span className="forum-field-count">{title.length}/150</span>
        <label>{t("Nội dung")}<textarea name="body" required rows={6} maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("Viết những suy nghĩ của bạn…")} aria-invalid={Boolean(errors.body)} /></label>
        <span className="forum-field-count">{body.length}/5.000</span>
        <label className="forum-checkbox"><input type="checkbox" name="spoiler" defaultChecked={post?.spoiler || false} /><ShieldAlert size={17} /> {t("Nội dung có spoiler (tiết lộ tình tiết)")}</label>
        {(Object.keys(errors).length > 0 || limitReached) && <p role="alert" className="forum-error">{limitReached ? t("Bạn đã đạt giới hạn 100 bài viết trên thiết bị này. Xóa bớt bài trước khi đăng thêm.") : Object.values(errors).map((error) => t(error)).join(" ")}</p>}
        <div className="forum-form-footer"><p className="forum-muted">{t("Bản demo · Bài viết chỉ lưu trên trình duyệt này.")}</p><button type="submit" className="forum-button forum-primary" disabled={!ready || limitReached}><Send size={17} /> {post ? t("Lưu thay đổi") : t("Đăng bài")}</button></div>
      </form> : <ForumSignIn onSignIn={signIn} ready={ready && sessionReady} />}
    </ForumDialog>
  );
}
