
"use client";

import { ChartNoAxesCombined, ChevronDown, Eye, HeartIcon, MessageCircle, Pencil, Plus, Share2, StarIcon, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n/LocaleProvider";
import { deleteChapterAction, deleteNovelAction } from "@/app/Writer/actions";
import './cardWriter.css'
export default function CardWriter({
    id,
    href,
    title,
    img,
    date,
    view,
    like,
    comment,
    current_chap,
    chapters = [],
    published = false,
    chaptersOpen,
    onToggleChapters,
    onCloseChapters,
}){
const { t } = useI18n();
const router = useRouter();
const [pending, startTransition] = useTransition();
const novelHref = href || `/Writer/novels/${id}`;
const formattedDate = new Date(date).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});
 const [message, setMessage] = useState("");
// Xoá qua Server Action (server kiểm tra quyền sở hữu), rồi tải lại dữ liệu từ database.
function runAction(action, successMessage) {
    setMessage("");
    startTransition(async () => {
        const result = await action();
        if (result?.error) { setMessage(result.error); return; }
        if (successMessage) setMessage(successMessage);
        router.refresh();
    });
}

function handleDeleteChapter(chapter) {
    if (!window.confirm(t("Xóa chương {0}? Bình luận và lượt thích của chương cũng bị xóa.", [chapter.number]))) return;
    runAction(() => deleteChapterAction(id, chapter.id), t("Đã xóa chương."));
}

function handleDeleteNovel() {
    if (!window.confirm(t("Bạn có chắc muốn xóa truyện “{0}” không? Thao tác này không thể hoàn tác.", [title]))) return;
    runAction(() => deleteNovelAction(id));
}

async function handleShare() {
    if (!published) { setMessage(t("Truyện chưa xuất bản nên chưa thể chia sẻ.")); return; }
    const url = new URL(novelHref, window.location.origin).toString();
    setMessage("");

    try {
      if (navigator.share) {
        await navigator.share({
          title: title,
          url: url,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setMessage(t("Đã sao chép link truyện!"));
      } else {
        setMessage(`${t("Hãy sao chép liên kết truyện:")} ${url}`);
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        setMessage(t("Không thể chia sẻ. Vui lòng thử lại."));
      }
    }
}

return(
    <div className=" ContaintCard bg-amber-50 flex flex-row justify-between h-fit gap-3.5  ">
        <div className="flex flex-row gap-4 mr-3">
            <div className="imgCards w-25 h-full relative ">
                <Image src={img} width={100} height={140} unoptimized className="object-cover rounded" alt={title} />
            </div>
            <div className="title">
                <h1><Link href={novelHref} className=" focus-visible:outline-2 focus-visible:outline-primary">{title}</Link></h1>
                <p className="text-green-600">Số chương đã đăng: {current_chap}{!published && <span className="ml-2 text-amber-600">· Chưa xuất bản</span>}</p>
                <p className="text-gray-500">Cập nhật lần cuối {formattedDate}</p>
                <div className="flex flex-row gap-5">
                    <p className=" icontext"><span><Eye/> </span><span>{view}</span></p>
                    <p className="icontext"><span><HeartIcon/></span><span>{like}</span></p>
                    <p className="icontext"><span><MessageCircle/></span><span>{comment}</span></p>
                </div>
            </div>
        </div>
       
        <div className="writer-card-actions mr-3">
            <div className="writer-card-write">
                <button
                    type="button"
                    className="btn-card"
                    aria-expanded={chaptersOpen}
                    aria-controls={`writer-chapters-${id}`}
                    onClick={onToggleChapters}
                >
                    <span>{t("Tiếp tục viết")}</span>
                    <ChevronDown aria-hidden="true" />
                </button>
                {chaptersOpen && (
                    <ul className="writer-card-menu" id={`writer-chapters-${id}`} aria-label={t("Danh sách chương của {0}", [title])}>
                        {chapters.map((chapter) => (
                            <li className="writer-card-menu__chapter" key={chapter.id}>
                                <span className="writer-card-menu__title">
                                    {t("Chương {0}: {1}", [chapter.number, chapter.title])}{chapter.status === "draft" && ` (${t("nháp")})`}
                                </span>
                                <div className="writer-card-menu__actions">
                                    <Link
                                        className="writer-card-menu__action"
                                        href={`/Writer/new?novelId=${encodeURIComponent(id)}&chapterId=${encodeURIComponent(chapter.id)}`}
                                        aria-label={t("Sửa chương {0}", [chapter.number])}
                                        onClick={onCloseChapters}
                                    >
                                        <Pencil size={16} aria-hidden="true" />
                                        <span>{t("Sửa")}</span>
                                    </Link>
                                    <button
                                        type="button"
                                        className="writer-card-menu__action writer-card-menu__delete"
                                        aria-label={t("Xóa chương {0}", [chapter.number])}
                                        disabled={pending}
                                        onClick={() => handleDeleteChapter(chapter)}
                                    >
                                        <Trash2 size={16} aria-hidden="true" />
                                        <span>{t("Xóa")}</span>
                                    </button>
                                </div>
                            </li>
                        ))}
                        <li className="writer-card-menu__add">
                            <Link
                                href={`/Writer/new?novelId=${encodeURIComponent(id)}`}
                                onClick={onCloseChapters}
                            >
                                <Plus size={16} aria-hidden="true" />
                                <span>{t("Thêm chương")}</span>
                            </Link>
                        </li>
                    </ul>
                )}
            </div>
            <div className="flex flex-row gap-1">
                <Link className="btn-card btn-card--stats" href={`/Writer/statistics/${id}`}>
                    <ChartNoAxesCombined/>{t("Thống kê")}
                </Link>
                <button type="button" className="btn-card btn-card--stats" onClick={handleShare}><Share2 size={18} />{t("Share")}</button>
                {(
                    <button
                        type="button"
                        className="btn-card btn-card--stats writer-card-menu__delete"
                        disabled={pending}
                        onClick={handleDeleteNovel}
                        aria-label={t("Xóa truyện {0}", [title])}
                    >
                        <Trash2 size={18} aria-hidden="true" />
                        {t("Xóa ")}
                    </button>
                )}
                {message && <p className="max-w-48 break-all text-sm text-green-600" role="status">{message}</p>}
            </div>
            
        </div>
    </div>
)
}