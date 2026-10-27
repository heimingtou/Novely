
"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import { useState } from "react";
import {
  BookmarkPlus,
  BookmarkCheck,
  Share2,
} from "lucide-react";

export default function NovelActions({ novelTitle }) {
  const { t } = useI18n();
  // Trạng thái lưu truyện
  const [isSaved, setIsSaved] = useState(false);
  const [message, setMessage] = useState("");

  // Xử lý Add to Library
  function handleLibrary() {
    const nextValue = !isSaved;
    setIsSaved(nextValue);

    setMessage(
      nextValue
        ? t("Đã thêm truyện vào Library!")
        : t("Đã xóa truyện khỏi Library!")
    );
  }

  // Xử lý Share
  async function handleShare() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: novelTitle,
          url: url,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setMessage(t("Đã sao chép link truyện!"));
      } else {
        setMessage(t("Hãy sao chép URL trên thanh địa chỉ."));
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setMessage(t("Không thể chia sẻ. Vui lòng thử lại."));
      }
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3">

        {/* Nút Library */}
        <button
          type="button"
          aria-pressed={isSaved}
          onClick={handleLibrary}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#FF5454] px-5 py-3 font-semibold text-white transition hover:opacity-90"
        >
          {isSaved ? (
            <BookmarkCheck size={20} />
          ) : (
            <BookmarkPlus size={20} />
          )}

          {isSaved ? t("Đã thêm vào Library") : t("Add to Library")}
        </button>

        {/* Nút Share */}
        <button
          type="button"
          onClick={handleShare}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-5 py-3 font-semibold transition hover:bg-secondary-bg"
        >
          <Share2 size={20} />{t("Share")} </button>
      </div>

      {message && (
        <p className="mt-3 text-sm text-green-600" role="status">
          {t(message)}
        </p>
      )}
    </div>
  );
}
