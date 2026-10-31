"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n/LocaleProvider";
import { useWriterDispatch, useWriterStore } from "@/components/Writer/useWriterStore";
import { WRITER_GENRES, validateNovelInput } from "@/lib/writer-model.mjs";

export default function WriterNovelDetail({ novelId }) {
  const { t } = useI18n();
  const [writerState, , ready] = useWriterStore();
  const dispatch = useWriterDispatch();
  const [activeTab, setActiveTab] = useState("contents");
  const [draftState, setDraftState] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const novel = writerState.novels.find((item) => item.id === novelId);
  const draft = draftState?.novelId === novelId ? draftState : novel;

  function updateDraft(field, value) {
    setDraftState((current) => {
      const currentDraft = current?.novelId === novelId ? current : novel;
      return { ...currentDraft, [field]: value, novelId };
    });
  }

  function handleSaveNovel(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const errors = validateNovelInput(draft);
    const firstError = Object.values(errors)[0];
    if (firstError) {
      setError(t(firstError));
      return;
    }

    dispatch({
      type: "UPDATE_NOVEL",
      novelId,
      novel: draft,
      now: new Date().toISOString(),
    });
    setDraftState(null);
    setMessage(t("Đã cập nhật thông tin truyện."));
  }

  function handleDeleteChapter(chapterId) {
    dispatch({
      type: "DELETE_CHAPTER",
      novelId,
      chapterId,
      now: new Date().toISOString(),
    });
    setMessage(t("Đã xóa chương."));
  }

  if (!ready) {
    return <main className="mx-auto w-full max-w-5xl px-6 py-10" role="status">{t("Đang tải dữ liệu…")}</main>;
  }

  if (!novel) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <p role="alert">{t("Không tìm thấy truyện cần thêm chapter trên trình duyệt này.")}</p>
        <Link className="mt-4 inline-flex text-primary" href="/Writer">{t("Quay lại danh sách truyện")}</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full flex-col px-6 py-10 md:flex-row">
     
      <section className="content w-full shrink-0 md:w-1/4">
        <div className="flex flex-row gap-5" >
          <div className="img w-full p-[35px]">
            <Image
                src={novel.coverImage}
                className="aspect-[2/3] h-auto w-full rounded object-cover"
                alt={t("Ảnh bìa truyện")}
                width={48}
                height={64}
                unoptimized
              />
            <h1>{draft.title}</h1>
            <div className="content_gen flex flex-row flex-wrap gap-4">
              {draft.genres.map((gen)=>(
                <div key={gen} className=" w-fit p-3 border-1 rounded-s-lg">
                  <span >{gen}</span>
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

      {activeTab === "contents" ? (
        <section className="rounded-2xl border border-border bg-card p-6" role="tabpanel">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{t("Danh sách chương")}</h2>
              <p className="mt-1 text-sm text-muted">{t("Đã cập nhật")} {novel.chapters.length} {t("chương")}</p>
            </div>
            <Link
              className="inline-flex items-center rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:opacity-90"
              href={`/Writer/new?novelId=${encodeURIComponent(novel.id)}`}
            >
              {t("Thêm chương")}
            </Link>
          </div>
          <hr/>
          {novel.chapters.length ? (
            <ul className="divide-y divide-border">
              {novel.chapters.map((chapter) => (
                <li key={chapter.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <span>{t("Chương")} {chapter.number}: {chapter.title}</span>
                  <div className="flex gap-2">
                    <Link
                      className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary-bg"
                      href={`/Writer/new?novelId=${encodeURIComponent(novel.id)}&chapterId=${encodeURIComponent(chapter.id)}`}
                    >
                      {t("Sửa")}
                    </Link>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      aria-label={t("Xóa chương {0}", [chapter.number])}
                      onClick={() => handleDeleteChapter(chapter.id)}
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
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-6" role="tabpanel">
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
                {WRITER_GENRES.map((genre) => (
                  <label key={genre} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.genres.includes(genre)}
                      onChange={(event) => updateDraft(
                        "genres",
                        event.target.checked
                          ? [...draft.genres, genre]
                          : draft.genres.filter((item) => item !== genre),
                      )}
                    />
                    <span>{t(genre)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
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
                className="rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:opacity-90"
                type="submit"
              >
                {t("Lưu thay đổi")}
              </button>
            </div>
          </form>
        </section>
      )}
      </section>
      
    </main>
  );
}
