"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const EVENT = "novely-reader-change";
const memory = new Map();
let storageFailed = false;
const serverSnapshot = () => null;
const serverReady = () => false;
const clientReady = () => true;

function subscribe(listener) {
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
}

function read(key) {
  if (memory.has(key)) return memory.get(key);
  try { return window.localStorage.getItem(key); }
  catch { return null; }
}

function decode(raw, fallback, normalize) {
  try { return normalize(raw === null ? fallback : JSON.parse(raw)); }
  catch { return normalize(fallback); }
}

// Snapshot là chuỗi ổn định; không đọc localStorage trong lần render trên server.
// Mọi lần cập nhật đều đọc giá trị mới nhất để không ghi đè dữ liệu tab khác.
export function useReaderStorage(key, fallback, normalize) {
  const getSnapshot = useCallback(() => read(key), [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const failed = useSyncExternalStore(subscribe, () => storageFailed, serverReady);
  const value = useMemo(() => decode(raw, fallback, normalize), [raw, fallback, normalize]);
  const update = useCallback((nextValue) => {
    const current = decode(read(key), fallback, normalize);
    const next = normalize(typeof nextValue === "function" ? nextValue(current) : nextValue);
    const serialized = JSON.stringify(next);
    try {
      window.localStorage.setItem(key, serialized);
      memory.delete(key);
    } catch {
      memory.set(key, serialized);
      storageFailed = true;
    }
    window.dispatchEvent(new Event(EVENT));
  }, [key, fallback, normalize]);
  return [value, update, ready, failed];
}
