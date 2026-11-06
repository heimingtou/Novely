"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import { useEffect, useSyncExternalStore } from "react";
import { Moon } from "lucide-react";
import { useLocalStorageState, updateLocalStorageState } from "@/lib/useLocalStorageState";
import { DEFAULT_SETTINGS, normalizeSettings } from "@/lib/reader-model.mjs";

const normalizeTheme = (value) => ["light", "dark"].includes(value) ? value : null;
const serverDark = () => false;
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
function subscribeSystem(listener) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

export function useSiteTheme() {
  const [preference, setPreference, ready] = useLocalStorageState("novely:v1:theme", null, normalizeTheme);
  const darkSystem = useSyncExternalStore(subscribeSystem, systemDark, serverDark);
  const theme = preference || (darkSystem ? "dark" : "light");
  return { theme, ready, setTheme(next) {
    // Áp dụng lựa chọn chung cho cả vùng đọc, giữ nguyên font và cỡ chữ.
    updateLocalStorageState("novely:v1:settings", (current) => ({ ...current, theme: next }), DEFAULT_SETTINGS, normalizeSettings);
    setPreference(next);
  } };
}

export function ThemeManager() {
  const { theme } = useSiteTheme();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return null;
}

export function ThemeToggle() {
  const { t } = useI18n();
  const { theme, setTheme, ready } = useSiteTheme();
  const dark = theme === "dark";
  return (
    <button type="button" role="switch" aria-label={t("Chế độ tối")} aria-checked={dark} disabled={!ready} className="site-theme-toggle" onClick={() => setTheme(dark ? "light" : "dark")}>
      <Moon size={21} /><span>{t("Chế độ tối")}</span><span className="site-theme-switch" aria-hidden="true"><span /></span>
    </button>
  );
}
