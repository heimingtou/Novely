"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function ForumDialog({ title, onClose, children }) {
  const { t } = useI18n();
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog className="forum-dialog" ref={dialogRef} aria-labelledby="forum-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="forum-dialog-heading"><div><span className="forum-eyebrow">{t("NOVELY COMMUNITY")}</span><h2 id="forum-dialog-title">{title}</h2></div><button type="button" className="forum-icon-button" aria-label={t("Đóng hộp thoại")} onClick={onClose}><X size={20} /></button></div>
      {children}
    </dialog>
  );
}
