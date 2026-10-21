"use client";

import { useState } from "react";

export default function NumericSetting({ id, label, value, min, max, step, unit, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  function normalize(number) {
    return Number(Math.min(max, Math.max(min, min + Math.round((number - min) / step) * step)).toFixed(2));
  }
  function commit() {
    if (draft.trim() && Number.isFinite(Number(draft))) onChange(normalize(Number(draft)));
    setEditing(false);
  }
  return (
    <div className="reader-setting-field">
      <div className="reader-setting-heading">
        <label htmlFor={id}>{label}</label>
        <div className="reader-number-field">
          <input
            type="number" aria-label={`Nhập ${label.toLowerCase()}`} title={`${min}–${max}${unit}`}
            min={min} max={max} step={step} inputMode={step < 1 ? "decimal" : "numeric"}
            value={editing ? draft : value}
            onFocus={() => { setDraft(String(value)); setEditing(true); }}
            onChange={(event) => {
              const text = event.target.value;
              setDraft(text);
              if (text.trim() && Number.isFinite(Number(text)) && Number(text) >= min && Number(text) <= max) onChange(normalize(Number(text)));
            }}
            onBlur={commit}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }}
          />
          <span aria-hidden="true">{unit}</span>
        </div>
      </div>
      <input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}
