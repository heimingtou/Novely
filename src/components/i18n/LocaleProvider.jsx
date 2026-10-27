"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useLocalStorageState } from "@/lib/useLocalStorageState";
import { createTranslator } from "@/lib/i18n/messages.mjs";

const LocaleContext = createContext(null);
const normalizeLocale = (value) => value === "en" ? "en" : "vi";

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
  return <footer className="site-footer">{t("noi khoi nguon cua nhung cau truyen")}</footer>;
}
