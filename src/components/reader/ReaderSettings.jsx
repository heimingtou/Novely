"use client";

import { RotateCcw, X } from "lucide-react";
import { DEFAULT_SETTINGS, READER_FONTS } from "@/lib/reader-model.mjs";
import NumericSetting from "./NumericSetting";

export default function ReaderSettings({ settings, onChange, onClose }) {
  function set(name, value) { onChange((current) => ({ ...current, [name]: value })); }
  return (
    <section id="reader-settings" className="reader-panel reader-settings" aria-labelledby="settings-heading">
      <div className="reader-section-heading">
        <div><span className="reader-eyebrow">THEO CÁCH CỦA BẠN</span><h2 id="settings-heading">Cài đặt đọc</h2></div>
        <button type="button" className="reader-icon-button" onClick={onClose} aria-label="Đóng cài đặt"><X size={20} /></button>
      </div>
      <div className="reader-settings-grid">
        <label htmlFor="reader-font">Phông chữ
          <select id="reader-font" aria-label="Phông chữ" value={settings.font} onChange={(event) => set("font", event.target.value)}>
            {READER_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
          </select>
        </label>
        <label htmlFor="reader-theme">Nền đọc
          <select id="reader-theme" aria-label="Nền đọc" value={settings.theme} onChange={(event) => set("theme", event.target.value)}>
            <option value="light">Sáng</option><option value="sepia">Giấy ấm · Sepia</option><option value="dark">Tối</option>
          </select>
        </label>
        <NumericSetting id="reader-font-size" label="Cỡ chữ" value={settings.fontSize} min={16} max={32} step={1} unit="px" onChange={(value) => set("fontSize", value)} />
        <NumericSetting id="reader-line-height" label="Giãn dòng" value={settings.lineHeight} min={1.4} max={2.4} step={0.1} unit="" onChange={(value) => set("lineHeight", value)} />
        <NumericSetting id="reader-width" label="Độ rộng tối đa" value={settings.width} min={560} max={1000} step={20} unit="px" onChange={(value) => set("width", value)} />
        <NumericSetting id="reader-brightness" label="Độ sáng vùng đọc" value={settings.brightness} min={70} max={110} step={5} unit="%" onChange={(value) => set("brightness", value)} />
      </div>
      {settings.font === "bookerly" && <p className="reader-caption reader-font-note">Bookerly dùng font đã cài trên thiết bị. Nếu chưa có, trang sẽ dùng Noto Serif.</p>}
      <div className="reader-settings-footer">
        <label className="reader-checkbox"><input type="checkbox" checked={settings.showProgress} onChange={(event) => set("showProgress", event.target.checked)} /> Hiện phần trăm đã đọc</label>
        <button type="button" className="reader-button" onClick={() => onChange(DEFAULT_SETTINGS)}><RotateCcw size={16} /> Mặc định</button>
      </div>
    </section>
  );
}
