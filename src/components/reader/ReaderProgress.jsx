"use client";

import { useI18n } from "@/components/i18n/LocaleProvider";
export default function ReaderProgress({ percent }) {
  const { t } = useI18n();
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="reader-progress-float" role="progressbar" aria-label={t("Tiến độ đọc chương")} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} title={t("Đã đọc {0}% chương này", [percent])}>
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <circle className="reader-progress-track" cx="28" cy="28" r={radius} />
        <circle className="reader-progress-ring" cx="28" cy="28" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} />
      </svg>
      <span>{percent}<small>%</small></span>
    </div>
  );
}
