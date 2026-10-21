"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, Headphones, Pause, Play, Square } from "lucide-react";

const subscribe = () => () => {};
const supported = () => typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
const unsupported = () => false;

export default function ReaderSpeech({ paragraphs, startIndex, onParagraph }) {
  const available = useSyncExternalStore(subscribe, supported, unsupported);
  const [status, setStatus] = useState("idle");
  const [rate, setRate] = useState(1);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  const utteranceRef = useRef(null);

  useEffect(() => () => {
    generation.current += 1;
    if (supported()) window.speechSynthesis.cancel();
  }, []);

  function stop() {
    generation.current += 1;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setStatus("idle");
  }

  function start() {
    generation.current += 1;
    const token = generation.current;
    const speech = window.speechSynthesis;
    speech.cancel();
    const voice = speech.getVoices().find((item) => item.lang.toLowerCase().startsWith("vi"));
    setMessage(voice ? "" : "Thiết bị chưa cung cấp giọng Việt; trình duyệt sẽ chọn giọng mặc định.");
    setStatus("speaking");
    function speakParagraph(index) {
      if (generation.current !== token) return;
      if (index >= paragraphs.length) { setStatus("idle"); return; }
      const utterance = new SpeechSynthesisUtterance(paragraphs[index].text);
      utterance.lang = "vi-VN";
      utterance.rate = rate;
      if (voice) utterance.voice = voice;
      utteranceRef.current = utterance;
      utterance.onstart = () => { if (generation.current === token) onParagraph(index); };
      utterance.onend = () => speakParagraph(index + 1);
      utterance.onerror = (event) => {
        if (generation.current !== token) return;
        setStatus("idle");
        if (event.error !== "canceled" && event.error !== "interrupted") setMessage("Không thể phát giọng đọc. Hãy kiểm tra giọng đọc trên thiết bị rồi thử lại.");
      };
      speech.speak(utterance);
    }
    speakParagraph(startIndex);
  }

  return (
    <details className="reader-speech" data-playing={status !== "idle"}>
      <summary><span><Headphones size={18} /> Nghe truyện</span><span className="reader-caption">{status === "speaking" ? "Đang nghe" : status === "paused" ? "Đã tạm dừng" : "Giọng đọc thiết bị"}<ChevronDown size={15} /></span></summary>
      <div className="reader-speech-body" role="region" aria-label="Nghe chương">
      <div className="reader-speech-controls">
        <button type="button" className="reader-button" disabled={!available} onClick={() => {
          if (status === "speaking") { window.speechSynthesis.pause(); setStatus("paused"); }
          else if (status === "paused") { window.speechSynthesis.resume(); setStatus("speaking"); }
          else start();
        }}>{status === "speaking" ? <Pause size={16} /> : <Play size={16} />}{status === "speaking" ? "Tạm dừng" : status === "paused" ? "Tiếp tục nghe" : "Nghe từ đoạn hiện tại"}</button>
        <button type="button" className="reader-icon-button" disabled={status === "idle"} onClick={stop} aria-label="Dừng nghe"><Square size={16} /></button>
        <label className="reader-rate">Tốc độ
          <select value={rate} disabled={status !== "idle"} onChange={(event) => setRate(Number(event.target.value))}>
            {[0.75, 1, 1.25, 1.5].map((value) => <option key={value} value={value}>{value}×</option>)}
          </select>
        </label>
      </div>
      <p className="reader-caption" role="status">{!available ? "Trình duyệt này chưa hỗ trợ nghe văn bản." : message || (status === "speaking" ? "Đang đọc · Giọng đọc do thiết bị cung cấp" : status === "paused" ? "Đã tạm dừng" : "Nghe bằng giọng đọc của thiết bị, bắt đầu tại vị trí đang đọc.")}</p>
      </div>
    </details>
  );
}
