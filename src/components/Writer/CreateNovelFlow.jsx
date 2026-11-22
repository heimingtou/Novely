"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n/LocaleProvider";
import { saveChapterAction, saveNovelAction } from "@/app/Writer/actions";
import "./create-novel.css";
import { UploadCloudIcon } from "lucide-react";

const MAX_COVER_BYTES = 750 * 1024;
const COVER_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Bước 1: tạo truyện (lưu vào database, ảnh bìa lên Supabase Storage).
// Bước 2: viết chương — đăng ngay hoặc lưu nháp. Server kiểm tra lại toàn bộ dữ liệu và quyền sở hữu.
export default function CreateNovelFlow({ genres, novel = null, chapter = null, loadError = "" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [novelForm, setNovelForm] = useState({ title: "", genreIds: [], description: "" });
  const [cover, setCover] = useState({ file: null, preview: "" });
  const [chapterTitle, setChapterTitle] = useState(chapter?.title ?? "");
  const [chapterContent, setChapterContent] = useState(chapter?.content ?? "");
  const [error, setError] = useState(loadError);
  const [message, setMessage] = useState("");
  const [coverError, setCoverError] = useState("");
  const activeStep = novel ? "chapter" : "novel";
  const previewHref = novel ? (novel.published ? `/novels/${novel.slug}` : `/Writer/novels/${novel.id}`) : "";

  function handleCoverChange(event) {
    const file = event.target.files?.[0];
    setCoverError("");
    if (!file) return;
    if (!COVER_TYPES.includes(file.type)) {
      setCoverError(t("Ảnh bìa phải có định dạng PNG, JPG hoặc WebP."));
      event.target.value = "";
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setCoverError(t("Ảnh bìa không được vượt quá 750 KB."));
      event.target.value = "";
      return;
    }
    if (cover.preview) URL.revokeObjectURL(cover.preview);
    setCover({ file, preview: URL.createObjectURL(file) });
  }

  function handleCreateNovel(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!novelForm.title.trim()) return setError(t("Vui lòng nhập tiêu đề truyện."));
    if (!novelForm.genreIds.length) return setError(t("Vui lòng chọn ít nhất một thể loại."));
    if (!cover.file) return setError(t("Vui lòng chọn ảnh bìa PNG, JPG hoặc WebP (tối đa 750 KB)."));
    if (!novelForm.description.trim()) return setError(t("Vui lòng nhập phần giới thiệu truyện."));

    const data = new FormData();
    data.set("title", novelForm.title);
    data.set("description", novelForm.description);
    novelForm.genreIds.forEach((id) => data.append("genre", String(id)));
    data.set("cover", cover.file);
    startTransition(async () => {
      const result = await saveNovelAction(null, data);
      if (result?.error) { setError(t(result.error)); return; }
      router.replace(`/Writer/new?novelId=${result.novelId}`);
    });
  }

  function handleSaveChapter(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!chapterTitle.trim()) return setError(t("Vui lòng nhập tên chương."));
    if (!chapterContent.trim()) return setError(t("Vui lòng nhập nội dung chương."));

    const data = new FormData();
    data.set("novelId", String(novel.id));
    if (chapter) data.set("chapterId", String(chapter.id));
    data.set("title", chapterTitle);
    data.set("content", chapterContent);
    data.set("intent", event.nativeEvent.submitter?.value === "draft" ? "draft" : "publish");
    startTransition(async () => {
      const result = await saveChapterAction(null, data);
      if (result?.error) { setError(t(result.error)); return; }
      if (!result.updated) { setChapterTitle(""); setChapterContent(""); }
      setMessage(t(result.message));
      router.refresh();
    });
  }

  return (
    <section className="writer-create">
      <header className="writer-create__header">
        <h1>{t("Câu truyện của bạn")}</h1>
      </header>

      <div className="writer-create__tabs" role="tablist" aria-label={t("Các bước tạo truyện")}>
        <button type="button" role="tab" aria-selected={activeStep === "novel"} className={activeStep === "novel" ? "is-active" : ""} disabled={activeStep === "chapter"}>
          <span>1</span>{t("Thông tin truyện")}
        </button>
        <button type="button" role="tab" aria-selected={activeStep === "chapter"} className={activeStep === "chapter" ? "is-active" : ""} disabled={activeStep !== "chapter"}>
          <span>2</span>{t("Thêm chapter")}
        </button>
      </div>

      {loadError ? (
        <div className="writer-create__form">
          <p className="writer-create__error" role="alert">{t(loadError)}</p>
          <Link className="writer-create__secondary" href="/Writer">{t("Quay lại danh sách truyện")}</Link>
        </div>
      ) : activeStep === "novel" ? (
        <form className="writer-create__form" onSubmit={handleCreateNovel}>
          <label className="writer-create__field">
            <span>{t("Tiêu đề truyện")} <b aria-hidden="true"className="text-red-500">*</b></span>
            <input
              type="text"
              maxLength={120}
              required
              value={novelForm.title}
              onChange={(event) => setNovelForm((form) => ({ ...form, title: event.target.value }))}
              placeholder={t("Nhập tiêu đề truyện")}
            />
          </label>

          <fieldset className="writer-create__genres">
            <legend>{t("Thể loại")} <b aria-hidden="true" className="text-red-500">*</b></legend>
            <p>{t("Có thể chọn nhiều thể loại.")}</p>
            <div className="writer-create__genre-grid">
              {genres.map((genre) => (
                <label key={genre.genre_id}>
                  <input
                    type="checkbox"
                    checked={novelForm.genreIds.includes(genre.genre_id)}
                    onChange={(event) => setNovelForm((form) => ({
                      ...form,
                      genreIds: event.target.checked
                        ? [...form.genreIds, genre.genre_id]
                        : form.genreIds.filter((item) => item !== genre.genre_id),
                    }))}
                  />
                  <span>{t(genre.name)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="writer-create__field">
            <label htmlFor="novel-cover">{t("Ảnh bìa")} <b aria-hidden="true" className="text-red-500">*</b></label>
            <p className="writer-create__hint">{t("Chọn ảnh PNG, JPG hoặc WebP, dung lượng tối đa 750 KB.")}</p>
            <div className="w-full h-14">
              <input id="novel-cover" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleCoverChange} />
              <label htmlFor="novel-cover"
    className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white font-medium rounded-lg cursor-pointer hover:bg-primary-hover transition-all shadow-sm gap-2">
                <UploadCloudIcon/>
              </label>
            </div>

            {cover.preview && (
              <Image className="writer-create__cover-preview" src={cover.preview} alt={t("Ảnh bìa truyện")} width={120} height={160} unoptimized />
            )}
            {coverError && <p className="writer-create__error" role="alert">{coverError}</p>}
          </div>

          <label className="writer-create__field">
            <span>{t("Giới thiệu")} <b aria-hidden="true"className="text-red-500">*</b></span>
            <textarea
              rows={5}
              maxLength={3000}
              required
              value={novelForm.description}
              onChange={(event) => setNovelForm((form) => ({ ...form, description: event.target.value }))}
              placeholder={t("Viết phần giới thiệu cho truyện…")}
            />
          </label>

          {error && <p className="writer-create__error" role="alert">{error}</p>}
          <button className="writer-create__primary" type="submit" disabled={pending}>{pending ? t("Đang lưu…") : t("Tạo")}</button>
        </form>
      ) : (
        <form className="writer-create__form" onSubmit={handleSaveChapter}>
          <h1 className="writer-create__story-title">{novel.title}</h1>
          {chapter && <p className="writer-create__hint">{t("Đang sửa chương {0}", [chapter.number])}{chapter.status === "draft" ? ` (${t("nháp")})` : ""}</p>}
          <label className="writer-create__field">
            <span>{t("Tên chap")} <b aria-hidden="true"className="text-red-500">*</b></span>
            <input
              type="text"
              maxLength={150}
              required
              value={chapterTitle}
              onChange={(event) => setChapterTitle(event.target.value)}
              placeholder={t("Ví dụ: Chương 1 - Khởi đầu")}
            />
          </label>
          <label className="writer-create__field">
            <span>{t("Nội dung chapter")} <b aria-hidden="true" className="text-red-500" >*</b></span>
            <textarea
              rows={16}
              maxLength={50000}
              required
              value={chapterContent}
              onChange={(event) => setChapterContent(event.target.value)}
              placeholder={t("Nhập nội dung chapter…")}
            />
            <small>{chapterContent.length.toLocaleString()} / 50.000 · {t("Để trống một dòng giữa các đoạn văn.")}</small>
          </label>
          {error && <p className="writer-create__error" role="alert">{error}</p>}
          {message && <p className="writer-create__success" role="status">{message}</p>}
          <div className="writer-create__actions">
            <button className="writer-create__primary" type="submit" value="publish" disabled={pending}>
              {pending ? t("Đang lưu…") : chapter ? t("Cập nhật chương") : t("Lưu chapter")}
            </button>
            <button className="writer-create__secondary" type="submit" value="draft" disabled={pending}>
              {t("Lưu nháp")}
            </button>
            <button
              className="writer-create__secondary"
              type="button"
              disabled={!novel.chapters.length}
              onClick={() => router.push(previewHref)}
            >
              {t("Xem trước")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
