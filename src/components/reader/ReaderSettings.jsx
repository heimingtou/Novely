"use client";
import { useI18n } from "@/components/i18n/LocaleProvider";

import { RotateCcw, X } from "lucide-react";
import { DEFAULT_SETTINGS, READER_FONTS } from "@/lib/reader-model.mjs";
import NumericSetting from "./NumericSetting";

export default function ReaderSettings({ settings, onChange, onClose }) {
  const { t } = useI18n();
  function set(name, value) { onChange((current) => ({ ...current, [name]: value })); }
  return (
    <section id="reader-settings" className="reader-panel reader-settings" aria-labelledby="settings-heading">
      <div className="reader-section-heading">
        <div><span className="reader-eyebrow">{t("THEO CÁCH CỦA BẠN")}</span><h2 id="settings-heading">{t("Cài đặt đọc")}</h2></div>
        <button type="button" className="reader-icon-button" onClick={onClose} aria-label={t("Đóng cài đặt")}><X size={20} /></button>
      </div>
      <div className="reader-settings-grid">
        <label htmlFor="reader-font">{t("Phông chữ")} <select id="reader-font" aria-label={t("Phông chữ")} value={settings.font} onChange={(event) => set("font", event.target.value)}>
            {READER_FONTS.map((font) => <option key={font.value} value={font.value}>{t(font.label)}</option>)}
          </select>
        </label>
        <label htmlFor="reader-theme">{t("Nền đọc")} <select id="reader-theme" aria-label={t("Nền đọc")} value={settings.theme} onChange={(event) => set("theme", event.target.value)}>
            <option value="light">{t("Sáng")}</option><option value="sepia">{t("Giấy ấm · Sepia")}</option><option value="dark">{t("Tối")}</option>
          </select>
        </label>
        <NumericSetting id="reader-font-size" label={t("Cỡ chữ")} value={settings.fontSize} min={16} max={32} step={1} unit="px" onChange={(value) => set("fontSize", value)} />
        <NumericSetting id="reader-line-height" label={t("Giãn dòng")} value={settings.lineHeight} min={1.4} max={2.4} step={0.1} unit="" onChange={(value) => set("lineHeight", value)} />
        <NumericSetting id="reader-width" label={t("Độ rộng tối đa")} value={settings.width} min={560} max={1000} step={20} unit="px" onChange={(value) => set("width", value)} />
        <NumericSetting id="reader-brightness" label={t("Độ sáng vùng đọc")} value={settings.brightness} min={70} max={110} step={5} unit="%" onChange={(value) => set("brightness", value)} />
      </div>
      {settings.font === "bookerly" && <p className="reader-caption reader-font-note">{t("Bookerly dùng font đã cài trên thiết bị. Nếu chưa có, trang sẽ dùng Noto Serif.")}</p>}
      <div className="reader-settings-footer">
        <label className="reader-checkbox"><input type="checkbox" checked={settings.showProgress} onChange={(event) => set("showProgress", event.target.checked)} /> {t("Hiện phần trăm đã đọc")}</label>
        <button type="button" className="reader-button" onClick={() => onChange(DEFAULT_SETTINGS)}><RotateCcw size={16} /> {t("Mặc định")}</button>
      </div>
    </section>
  );
}
