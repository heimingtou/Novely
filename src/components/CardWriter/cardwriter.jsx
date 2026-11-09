"use client";
import { ChartNoAxesCombined, Eye, MessageCircle, Share2, StarIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n/LocaleProvider";
import "./cardWriter.css";

export default function CardWriter({ id, title, img, date, view, like, comment, current_chap, draft = false, onWrite }) {
  const { t, locale } = useI18n();
  const [message, setMessage] = useState("");
  const formattedDate = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(date));
  async function handleShare() {
    const url = new URL('/novels/' + encodeURIComponent(id), window.location.origin).toString();
    setMessage("");
    try {
      if (navigator.share) await navigator.share({ title, url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setMessage("Đã sao chép link truyện!"); }
      else setMessage(url);
    } catch (error) { if (error?.name !== "AbortError") setMessage("Không thể chia sẻ. Vui lòng thử lại."); }
  }
  return <article className="ContaintCard">
    <div className="writer-card-info"><div className="imgCards"><Image src={img} width={100} height={140} alt={title} className="object-cover rounded" /></div>
      <div className="title"><h2>{title}</h2><p>{draft ? t("Bản nháp") : t("Số chương đã đăng: {0}", [current_chap])}</p><p className="writer-caption">{t("Cập nhật lần cuối {0}", [formattedDate])}</p>
        <div className="writer-card-counts"><span className="icontext"><Eye size={18}/>{view}</span><span className="icontext"><StarIcon size={18}/>{like}</span><span className="icontext"><MessageCircle size={18}/>{comment}</span></div>
      </div>
    </div>
    <div className="writer-card-actions"><button type="button" className="btn-card" onClick={onWrite}>{t("Tiếp tục viết")}</button>
      {!draft && <div className="writer-card-links"><Link className="btn-card btn-card--stats" aria-label={t("Thống kê truyện")} href={'/Writer/statistics/' + id}><ChartNoAxesCombined/></Link><button type="button" className="btn-card btn-card--stats" aria-label={t("Share")} onClick={handleShare}><Share2/></button></div>}
      {message && <p className="writer-share-status" role="status">{t(message)}</p>}
    </div>
  </article>;
}
