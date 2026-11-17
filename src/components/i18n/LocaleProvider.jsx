"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Languages, Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useLocalStorageState } from "@/lib/useLocalStorageState";
import { createTranslator } from "@/lib/i18n/messages.mjs";
import logoLight from "../../../public/logo.png";
import logoDark from "../../../public/darklogo.png";

const LocaleContext = createContext(null);
const normalizeLocale = (value) => value === "en" ? "en" : "vi";

function SocialIcon({ name }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true };
  if (name === "Facebook") return <svg {...common}><path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.6v3.1h2.7v8h3.2Z" /></svg>;
  if (name === "Instagram") return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.5" cy="6.5" r="1.2" /></svg>;
  if (name === "LinkedIn") return <svg {...common}><path d="M5.2 8.5a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8ZM3.6 10h3.2v10H3.6zM9 10h3v1.4h.1c.4-.8 1.5-1.7 3.2-1.7 3.4 0 4 2.2 4 5.1V20h-3.2v-4.6c0-1.1 0-2.6-1.6-2.6s-1.9 1.2-1.9 2.5V20H9z" /></svg>;
  return <MessageCircle size={18} aria-hidden="true" />;
}

export function LocaleProvider({ initialLocale, children }) {
  const [locale, setLocale, ready] = useLocalStorageState("novely:v1:locale", initialLocale, normalizeLocale);
  const router = useRouter();
  const renderedLocale = useRef(initialLocale);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
    document.cookie = `novely-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    if (renderedLocale.current !== locale) {
      renderedLocale.current = locale;
      router.refresh();
    }
  }, [locale, ready, router]);
  const value = useMemo(() => ({ locale, setLocale, ready, t: createTranslator(locale) }), [locale, setLocale, ready]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useI18n requires LocaleProvider");
  return value;
}

export function LanguageSwitcher() {
  const { locale, setLocale, ready } = useI18n();
  return <div className="site-language-control">
    <span><Languages size={21} />{locale === "vi" ? "Ngôn ngữ" : "Language"}</span>
    <div className="site-language-options" role="group" aria-label={locale === "vi" ? "Ngôn ngữ giao diện" : "Interface language"}>
      <button type="button" lang="vi" aria-pressed={locale === "vi"} disabled={!ready} onClick={() => setLocale("vi")}>Tiếng Việt</button>
      <button type="button" lang="en" aria-pressed={locale === "en"} disabled={!ready} onClick={() => setLocale("en")}>English</button>
    </div>
  </div>;
}

export function SiteFooter() {
  const { t } = useI18n();
  return <footer className="site-footer rounded-tl-2xl rounded-tr-4xl">
    <div className="site-footer-inner">
      <div className="site-footer-brand">
        <Link href="/" className="w-[35%]">
          <Image src={logoLight} alt="logo" className="block dark:hidden" />
          <Image src={logoDark} alt="logo" className="hidden dark:block" />
        </Link>
        <p className="site-footer-slogan">{t("noi khoi nguon cua nhung cau truyen")}</p>
        <p className="site-footer-description">Chào mừng bạn đến với Novely — không gian đọc truyện trực tuyến hiện đại, nơi mỗi trang chữ đều được chăm chút để mang lại trải nghiệm thư giãn và trọn vẹn nhất cho người yêu sách. Dù bạn say mê tiểu thuyết dài kỳ, giả tưởng, trinh thám, học đường hay những mẩu truyện ngắn đầy cảm hứng, Novely luôn sẵn sàng mở ra một thế giới mới ngay trên màn hình của bạn.</p>
        <nav className="site-footer-socials" aria-label="Liên hệ trên mạng xã hội">
          <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook"><SocialIcon name="Facebook" /></a>
          <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram"><SocialIcon name="Instagram" /></a>
          <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer" aria-label="LinkedIn"><SocialIcon name="LinkedIn" /></a>
          <a href="https://zalo.me/" target="_blank" rel="noreferrer" aria-label="Zalo"><SocialIcon name="Zalo" /></a>
        </nav>
      </div>

      <div className="site-footer-bottom">
        <a href="mailto:hello@novely.vn"><Mail size={15} />hello@novely.vn</a>
        <a href="tel:+84000000000"><Phone size={15} />+84 (0) 000 000 000</a>
        <span><MapPin size={15} />Việt Nam</span>
        <span className="site-footer-copyright">© {new Date().getFullYear()} Novely</span>
      </div>
    </div>
  </footer>;
}
