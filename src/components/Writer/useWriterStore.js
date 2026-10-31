"use client";

import { useLocalStorageState } from "@/lib/useLocalStorageState";
import { EMPTY_WRITER, normalizeWriterState, WRITER_STORAGE_KEY } from "@/lib/writer-model.mjs";

export function useWriterStore() {
  return useLocalStorageState(WRITER_STORAGE_KEY, EMPTY_WRITER, normalizeWriterState);
}
