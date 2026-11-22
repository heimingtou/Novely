"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n/LocaleProvider";
import { deleteChapterAction, saveNovelAction } from "@/app/Writer/actions";

const MAX_COVER_BYTES = 750 * 1024;
const draftFrom = (novel) => ({ title: novel.title, genreIds: novel.genreIds, description: novel.description, status: novel.status });

// Trang quản lý truyện của tác giả (dữ liệu từ database; page server đã kiểm tra quyền sở hữu).
export default function WriterNovelDetail({ novel, genres }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("contents");
  const [draft, setDraft] = useState(() => draftFrom(novel));
  const [cover, setCover] = useState({ file: null, preview: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const genreName = (id) => genres.find((genre) => genre.genre_id === id)?.name ?? "";

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleCoverChange(event) {
    const file = event.target.files?.[0];
    setError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > MAX_COVER_BYTES) {
      setError(t("Vui lòng chọn ảnh bìa PNG, JPG hoặc WebP (tối đa 750 KB)."));
      event.target.value = "";
      return;
    }
    if (cover.preview) URL.revokeObjectURL(cover.preview);
    setCover({ file, preview: URL.createObjectURL(file) });
  }

  function handleSaveNovel(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const data = new FormData();
    data.set("novelId", String(novel.id));
    data.set("title", draft.title);
    data.set("description", draft.description);
    data.set("status", draft.status);
    draft.genreIds.forEach((id) => data.append("genre", String(id)));
    if (cover.file) data.set("cover", cover.file);
    startTransition(async () => {
      const result = await saveNovelAction(null, data);
      if (result?.error) { setError(t(result.error)); return; }
      setMessage(t(result.message));
      setCover({ file: null, preview: "" });
      router.refresh();
    });
  }

  function handleDeleteChapter(chapter) {
    if (!window.confirm(t("Xóa chương {0}? Bình luận và lượt thích của chương cũng bị xóa.", [chapter.number]))) return;
    setMessage("");
    startTransition(async () => {
      const result = await deleteChapterAction(novel.id, chapter.id);
      if (result?.error) { setError(t(result.error)); return; }
      setMessage(t("Đã xóa chương."));
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex w-full  flex-col px-6 py-10 md:flex-row">

      <section className="w-full min-w-0 md:w-1/4">
        <div className="flex flex-row gap-5" >
          <div className="img w-full p-[35px]  ">
            <Image
                src={cover.preview || novel.coverImage}
                className="aspect-[2/3] h-auto w-full max-w-[240px] rounded object-cover"
                alt={t("Ảnh bìa truyện")}
                width={240}
                height={360}
                unoptimized
              />
            <h1>{novel.title}</h1>
            <p className="my-2 text-sm text-muted">
              {novel.published
                ? <Link className="text-primary hover:underline" href={`/novels/${novel.slug}`}>{t("Xem trang truyện công khai")}</Link>
                : t("Chưa xuất bản — truyện hiển thị công khai khi có ít nhất một chương đã đăng.")}
            </p>
            <div className="content_gen flex flex-row flex-wrap gap-4">
              {draft.genreIds.map((id)=>(
                <div key={id} className=" w-fit p-3 border-1 rounded-s-lg">
                  <span >{t(genreName(id))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="containt_tab_edit w-full min-w-0 md:w-3/4">
        <nav className="mb-6 flex gap-2 border-b border-border" role="tablist" aria-label={t("Quản lý truyện")}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "contents"}
          onClick={() => setActiveTab("contents")}
          className={`border-b-2 px-4 py-3 font-semibold ${activeTab === "contents" ? "border-primary text-primary" : "border-transparent text-muted"}`}
        >
          {t("Mục lục")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "details"}
          onClick={() => setActiveTab("details")}
          className={`border-b-2 px-4 py-3 font-semibold ${activeTab === "details" ? "border-primary text-primary" : "border-transparent text-muted"}`}
        >
          {t("Chi tiết truyện")}
        </button>
      </nav>

      {message && <p className="mb-4 text-sm text-green-600" role="status">{message}</p>}
      {error && activeTab === "contents" && <p className="mb-4 text-sm text-red-600" role="alert">{error}</p>}

      {activeTab === "contents" ? (

        <section role="tabpanel">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 pl-2 pr-1">
            <div>
              <h2 className="text-2xl font-bold">{t("Danh sách chương")}</h2>
              <p className="mt-1 text-sm text-muted">{t("Đã cập nhật")} {novel.chapters.length} {t("chương")}</p>
            </div>
            <Link
              className="inline-flex items-center rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:opacity-90"
              href={`/Writer/new?novelId=${novel.id}`}
            >
              {t("Thêm chương")}
            </Link>
          </div>

          <div className="rounded-[0.5rem] border border-border bg-card p-6">
            {novel.chapters.length ? (
            <ul className="divide-y divide-border">
              {novel.chapters.map((chapter) => (
                <li key={chapter.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <span>
                    {t("Chương")} {chapter.number}: {chapter.title}
                    {chapter.status === "draft"
                      ? <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{t("nháp")}</span>
                      : <span className="ml-2 text-xs text-muted">{chapter.date}</span>}
                  </span>
                  <div className="flex gap-2">
                    <Link
                      className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary-bg"
                      href={`/Writer/new?novelId=${novel.id}&chapterId=${chapter.id}`}
                    >
                      {t("Sửa")}
                    </Link>
                    <button
                      type="button"
                      disabled={pending}
                      className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      aria-label={t("Xóa chương {0}", [chapter.number])}
                      onClick={() => handleDeleteChapter(chapter)}
                    >
                      {t("Xóa")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{t("Chưa có chương nào.")}</p>
          )}
          </div>

        </section>
      ) : (
        <section className="" role="tabpanel">
          <form className="grid gap-5" onSubmit={handleSaveNovel}>
            <label className="grid gap-2 font-semibold">
              <span>{t("Tiêu đề truyện")}</span>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-normal"
                type="text"
                maxLength={120}
                required
                value={draft.title}
                onChange={(event) => updateDraft("title", event.target.value)}
              />
            </label>
            <fieldset className="grid gap-3">
              <legend className="font-semibold">{t("Thể loại")}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {genres.map((genre) => (
                  <label key={genre.genre_id} className="flex items-center gap-2  p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.genreIds.includes(genre.genre_id)}
                      onChange={(event) => updateDraft(
                        "genreIds",
                        event.target.checked
                          ? [...draft.genreIds, genre.genre_id]
                          : draft.genreIds.filter((item) => item !== genre.genre_id),
                      )}
                    />
                    <span>{t(genre.name)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-2 font-semibold">
              <span>{t("Trạng thái")}</span>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-normal"
                value={draft.status}
                onChange={(event) => updateDraft("status", event.target.value)}
              >
                <option value="ongoing">{t("Đang cập nhật")}</option>
                <option value="completed">{t("Hoàn thành")}</option>
              </select>
            </label>
            <label className="grid gap-2 font-semibold">
              <span>{t("Ảnh bìa")} <small className="font-normal text-muted">({t("để trống nếu giữ ảnh cũ")})</small></span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="font-normal" onChange={handleCoverChange} />
            </label>
            <label className="grid gap-2 font-semibold">
              <span>{t("Giới thiệu")}</span>
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-normal"
                rows={6}
                maxLength={3000}
                required
                value={draft.description}
                onChange={(event) => updateDraft("description", event.target.value)}
              />
            </label>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
                type="submit"
                disabled={pending}
              >
                {pending ? t("Đang lưu…") : t("Lưu thay đổi")}
              </button>
            </div>
          </form>
        </section>
      )}
      </section>

    </main>
  );
}
