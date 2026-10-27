"use client";

import { LogIn, UserRound } from "lucide-react";
import { useI18n } from "@/components/i18n/LocaleProvider";

export function ForumAccount({ account }) {
  const { t } = useI18n();
  return <p className="forum-account"><UserRound size={17} /><span>{t("Tài khoản")}: <strong>{account.name}</strong></span></p>;
}

export function ForumSignIn({ onSignIn, ready, comment = false }) {
  const { t } = useI18n();
  return <div className="forum-sign-in">
    <p className="forum-muted">{t("Đăng nhập để đăng bài và bình luận.")}</p>
    <button type="button" className="forum-button forum-primary" disabled={!ready} onClick={onSignIn}><LogIn size={17} />{t(comment ? "Đăng nhập để bình luận" : "Đăng nhập để đăng bài")}</button>
  </div>;
}
