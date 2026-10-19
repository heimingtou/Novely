
"use client";

import { useState } from "react";
import {
  BookmarkPlus,
  BookmarkCheck,
  Share2,
} from "lucide-react";

export default function NovelActions({ novelTitle }) {
  // Trạng thái lưu truyện
  const [isSaved, setIsSaved] = useState(false);
  const [message, setMessage] = useState("");

  // Xử lý Add to Library
  function handleLibrary() {
    const nextValue = !isSaved;
    setIsSaved(nextValue);

    setMessage(
      nextValue
        ? "Đã thêm truyện vào Library!"
        : "Đã xóa truyện khỏi Library!"
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
        setMessage("Đã sao chép link truyện!");
      } else {
        setMessage("Hãy sao chép URL trên thanh địa chỉ.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setMessage("Không thể chia sẻ. Vui lòng thử lại.");
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

          {isSaved ? "Đã thêm vào Library" : "Add to Library"}
        </button>

        {/* Nút Share */}
        <button
          type="button"
          onClick={handleShare}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 px-5 py-3 font-semibold transition hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Share2 size={20} />
          Share
        </button>
      </div>

      {message && (
        <p className="mt-3 text-sm text-green-600" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
