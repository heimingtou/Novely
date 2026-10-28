
"use client";

import { ChartNoAxesCombined, Eye, EyeDashedIcon, MessageCircle, Share2, StarIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n/LocaleProvider";
import './cardWriter.css'
export default function CardWriter({id, title, img, date, view, like, comment,current_chap}){
const { t } = useI18n();
const formattedDate = new Date(date).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});
 const [message, setMessage] = useState("");
async function handleShare() {
    const url = new URL(`/novels/${encodeURIComponent(id)}`, window.location.origin).toString();
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
                <Image src={img} className="object-cover rounded" alt="img" />
            </div>
            <div className="title">
                <h1>{title}</h1>
                <p className="text-green-300">Số chương đã đăng: {current_chap}</p>
                <p className="text-gray-500">Cập nhật lần cuối {formattedDate}</p>
                <div className="flex flex-row gap-5">
                    <p className=" icontext"><span><Eye/> </span><span>{view}</span></p>
                    <p className="icontext"><span><StarIcon/></span><span>{like}</span></p>
                    <p className="icontext"><span><MessageCircle/></span><span>{comment}</span></p>
                </div>
            </div>
        </div>
       
        <div className="writer-card-actions mr-3">
            <button className="btn-card"><span>Tiếp tục viết</span></button>
            <div className="flex flex-row gap-2">
                <Link className="btn-card btn-card--stats" href={`/Writer/statistics/${id}`}>
                    <ChartNoAxesCombined/>
                </Link>
                <button type="button" className="btn-card btn-card--stats" onClick={handleShare}>{t(<Share2/>) }</button>
                {message && <p className="max-w-48 break-all text-sm text-green-600" role="status">{message}</p>}
            </div>
            
        </div>
    </div>
)
}