"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/components/i18n/LocaleProvider";
import { useDemoSession } from "@/lib/useDemoSession";

export default function WriterEditor({ story, onSave, onClose }) {
  const { t } = useI18n();
  const { account, signIn } = useDemoSession();
  const dialogRef = useRef(null);
  const [title, setTitle] = useState(story?.title || "");
  const [body, setBody] = useState(story?.body || "");
  const [series, setSeries] = useState(story?.series || false);
  const [error, setError] = useState("");
  useEffect(() => { const dialog = dialogRef.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={dialogRef} className="writer-editor" aria-labelledby="writer-editor-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="writer-editor-heading"><h2 id="writer-editor-title">{t(story ? "Tiếp tục viết" : "Tạo truyện mới")}</h2><button type="button" aria-label={t("Đóng hộp thoại")} onClick={onClose}><X /></button></div>
    <p>{t("Bản nháp chỉ lưu trên trình duyệt này, chưa xuất bản. Nội dung chương đã đăng không có trong dữ liệu mẫu.")}</p>
    {account ? <form onSubmit={event => {
      event.preventDefault();
      if (!title.trim() || !body.trim()) { setError("Vui lòng nhập tiêu đề và nội dung."); return; }
      onSave({ id: story?.id || `draft-${crypto.randomUUID()}`, title: title.trim(), body, series, date: new Date().toISOString() });
    }}>
      <p>{t("Tài khoản")}: <strong>{account.name}</strong></p>
      <label>{t("Tên truyện")}<input required maxLength={150} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label htmlFor="writer-manuscript">{t("Bản thảo")}</label><textarea id="writer-manuscript" required rows={12} maxLength={50000} value={body} onChange={event => setBody(event.target.value)} />
      <label className="writer-series-field"><input type="checkbox" checked={series} onChange={event => setSeries(event.target.checked)} />{t("Truyện dài kỳ")}</label>
      {error && <p role="alert">{t(error)}</p>}
      <button className="btn" type="submit">{t("Lưu bản nháp")}</button>
    </form> : <button className="btn" type="button" onClick={signIn}>{t("Đăng nhập để viết truyện")}</button>}
  </dialog>;
}
