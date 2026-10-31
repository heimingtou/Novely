"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n/LocaleProvider";
import { validateChapterInput, validateNovelInput, WRITER_GENRES } from "@/lib/writer-model.mjs";
import { useWriterDispatch, useWriterStore } from "@/components/Writer/useWriterStore";
import "./create-novel.css";
import { UploadCloudIcon } from "lucide-react";

const MAX_COVER_BYTES = 750 * 1024;
const initialNovel = { title: "", genres: [], coverImage: "", description: "" };

function createId() {
  return crypto.randomUUID();
}

export default function CreateNovelFlow({ novelId: existingNovelId = "", chapterId = "" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [writerState, , ready, storageFailed] = useWriterStore();
  const dispatch = useWriterDispatch();
  const [step, setStep] = useState("novel");
  const [novelForm, setNovelForm] = useState(initialNovel);
  const [novelId, setNovelId] = useState("");
  const [chapterDraftState, setChapterDraftState] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [coverError, setCoverError] = useState("");
  const existingNovel = existingNovelId
    ? writerState.novels.find((item) => item.id === existingNovelId)
    : null;
  const existingChapter = existingNovel?.chapters.find((item) => item.id === chapterId);
  const activeStep = existingNovelId ? "chapter" : step;
  const chapterDraft = chapterDraftState?.chapterId === chapterId ? chapterDraftState : null;
  const chapterTitle = chapterDraft?.title ?? existingChapter?.title ?? "";
  const chapterContent = chapterDraft?.content ?? existingChapter?.content ?? "";

  function updateChapterDraft(field, value) {
    setChapterDraftState((current) => {
      const draft = current?.chapterId === chapterId
        ? current
        : {
            chapterId,
            title: existingChapter?.title || "",
            content: existingChapter?.content || "",
          };
      return { ...draft, [field]: value };
    });
  }

  function handleCoverChange(event) {
    const file = event.target.files?.[0];
    setCoverError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setCoverError(t("Ảnh bìa phải có định dạng PNG, JPG hoặc WebP."));
      event.target.value = "";
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setCoverError(t("Ảnh bìa không được vượt quá 750 KB."));
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setCoverError(t("Không thể đọc ảnh bìa. Vui lòng thử lại."));
        return;
      }
      setNovelForm((form) => ({ ...form, coverImage: reader.result }));
    };
    reader.onerror = () => setCoverError(t("Không thể đọc ảnh bìa. Vui lòng thử lại."));
    reader.readAsDataURL(file);
  }

  function handleCreateNovel(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const errors = validateNovelInput(novelForm);
    const firstError = Object.values(errors)[0];
    if (firstError) {
      setError(t(firstError));
      return;
    }

    const id = createId();
    dispatch({ type: "CREATE_NOVEL", novel: novelForm, id, now: new Date().toISOString() });
    setNovelId(id);
    setStep("chapter");
  }

  function handleAddChapter(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const input = { title: chapterTitle, content: chapterContent };
    const errors = validateChapterInput(input);
    const firstError = Object.values(errors)[0];
    if (firstError) {
      setError(t(firstError));
      return;
    }

    if (chapterId) {
      dispatch({
        type: "UPDATE_CHAPTER",
        novelId: existingNovelId,
        chapterId,
        chapter: input,
        now: new Date().toISOString(),
      });
      setMessage(t("Đã cập nhật chương."));
    } else {
      dispatch({
        type: "ADD_CHAPTER",
        novelId: existingNovelId || novelId,
        chapter: input,
        id: createId(),
        now: new Date().toISOString(),
      });
      setChapterDraftState({ chapterId, title: "", content: "" });
      setMessage(t("Đã lưu chương. Bạn có thể viết chương tiếp theo."));
    }
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

      {!ready ? (
        <p className="writer-create__notice" role="status">{t("Đang tải dữ liệu…")}</p>
      ) : existingNovelId && !existingNovel ? (
        <div className="writer-create__form">
          <p className="writer-create__error" role="alert">{t("Không tìm thấy truyện cần thêm chapter trên trình duyệt này.")}</p>
          <Link className="writer-create__secondary" href="/Writer">{t("Quay lại danh sách truyện")}</Link>
        </div>
      ) : chapterId && !existingChapter ? (
        <div className="writer-create__form">
          <p className="writer-create__error" role="alert">{t("Không tìm thấy chương cần sửa trên trình duyệt này.")}</p>
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
              {WRITER_GENRES.map((genre) => (
                <label key={genre}>
                  <input
                    type="checkbox"
                    checked={novelForm.genres.includes(genre)}
                    onChange={(event) => setNovelForm((form) => ({
                      ...form,
                      genres: event.target.checked
                        ? [...form.genres, genre]
                        : form.genres.filter((item) => item !== genre),
                    }))}
                  />
                  <span>{t(genre)}</span>
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
            
            {novelForm.coverImage && (
              <Image className="writer-create__cover-preview" src={novelForm.coverImage} alt={t("Ảnh bìa truyện")} width={120} height={160} unoptimized />
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
          <button className="writer-create__primary" type="submit">{t("Tạo")}</button>
        </form>
      ) : (
        <form className="writer-create__form" onSubmit={handleAddChapter}>
          <h1 className="writer-create__story-title">{existingNovel?.title || novelForm.title}</h1>
          <label className="writer-create__field">
            <span>{t("Tên chap")} <b aria-hidden="true"className="text-red-500">*</b></span>
            <input
              type="text"
              maxLength={150}
              required
              value={chapterTitle}
              onChange={(event) => updateChapterDraft("title", event.target.value)}
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
              onChange={(event) => updateChapterDraft("content", event.target.value)}
              placeholder={t("Nhập nội dung chapter…")}
            />
            <small>{chapterContent.length.toLocaleString()} / 50.000</small>
          </label>
          {error && <p className="writer-create__error" role="alert">{error}</p>}
          {message && <p className="writer-create__success" role="status">{message}</p>}
          <div className="writer-create__actions">
            <button className="writer-create__primary" type="submit">
              {chapterId ? t("Cập nhật chương") : t("Lưu chapter")}
            </button>
            <button
              className="writer-create__secondary"
              type="button"
              disabled={!(existingNovel || writerState.novels.find((novel) => novel.id === novelId))?.chapters.length}
              onClick={() => router.push(`/novels/${encodeURIComponent(existingNovelId || novelId)}`)}
            >
              {t("Xem trước")}
            </button>
          </div>
        </form>
      )}

      {storageFailed && <p className="writer-create__notice" role="status">{t("Trình duyệt không cho phép lưu dữ liệu hoặc đã hết dung lượng. Truyện chỉ được giữ trong phiên này.")}</p>}
    </section>
  );
}
