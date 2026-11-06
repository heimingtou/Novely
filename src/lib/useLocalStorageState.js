"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const EVENT = "novely-local-storage-change";
const memory = new Map();
let storageFailed = false;
const serverSnapshot = () => null;
const serverReady = () => false;
const clientReady = () => true;

function subscribe(listener) {
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(EVENT, listener); };
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

// Dùng chung cho cập nhật một khóa và thao tác hàng loạt; giữ cả bộ nhớ
// dự phòng và thông báo để giao diện/các tab cập nhật cùng nguồn dữ liệu.
export function updateLocalStorageState(key, nextValue, fallback, normalize) {
  const current = decode(read(key), fallback, normalize);
  const next = normalize(typeof nextValue === "function" ? nextValue(current) : nextValue);
  const serialized = JSON.stringify(next);
  try { window.localStorage.setItem(key, serialized); memory.delete(key); }
  catch { memory.set(key, serialized); storageFailed = true; }
  window.dispatchEvent(new Event(EVENT));
  return next;
}

// Cùng một nguồn dữ liệu giữa các component/tab; chỉ đọc sau hydration.
export function useLocalStorageState(key, fallback, normalize) {
  const getSnapshot = useCallback(() => read(key), [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const failed = useSyncExternalStore(subscribe, () => storageFailed, serverReady);
  const value = useMemo(() => decode(raw, fallback, normalize), [raw, fallback, normalize]);
  const update = useCallback((nextValue) => updateLocalStorageState(key, nextValue, fallback, normalize), [key, fallback, normalize]);
  return [value, update, ready, failed];
}
