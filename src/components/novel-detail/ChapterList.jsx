
"use client";

import { useState } from "react";
import { ArrowDownUp, BookOpen } from "lucide-react";

export default function ChapterList({ chapters }) {
  const [newestFirst, setNewestFirst] = useState(false);

  // Sắp xếp chương theo thứ tự
  const sortedChapters = [...chapters].sort((a, b) =>
    newestFirst
      ? b.number - a.number
      : a.number - b.number
  );

  return (
    <section
      id="chapters"
      className="mt-8 rounded-2xl border border-border bg-card p-6"
    >
      {/* Tiêu đề danh sách */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">
            Danh sách chương
          </h2>

          <p className="mt-1 text-sm text-muted">
            Đã cập nhật {chapters.length} chương
          </p>
        </div>

        {/* Nút sắp xếp */}
        <button
          type="button"
          onClick={() => setNewestFirst(!newestFirst)}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary-bg"
        >
          <ArrowDownUp size={16} />

          {newestFirst ? "Mới nhất" : "Cũ nhất"}
        </button>
      </div>

      {/* Danh sách chương */}
      <div className="divide-y divide-border">
        {sortedChapters.map((chapter) => (
          <div
            key={chapter.number}
            className="flex items-center justify-between gap-4 py-4"
          >
            <div className="flex items-center gap-3">
              <BookOpen
                size={18}
                className="shrink-0 text-primary"
              />

              <div>
                <p className="font-medium">
                  Chương {chapter.number}: {chapter.title}
                </p>

                <p className="mt-1 text-xs text-muted">
                  {chapter.date}
                </p>
              </div>
            </div>

            {chapter.isNew && (
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                Mới
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
