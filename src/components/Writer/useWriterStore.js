"use client";

import { useCallback } from "react";
import { useLocalStorageState } from "@/lib/useLocalStorageState";
import {
  addWriterChapter,
  createWriterNovel,
  deleteWriterChapter,
  deleteWriterNovel,
  EMPTY_WRITER,
  normalizeWriterState,
  updateWriterChapter,
  updateWriterNovel,
  WRITER_STORAGE_KEY,
} from "@/lib/writer-model.mjs";

export function useWriterStore() {
  return useLocalStorageState(WRITER_STORAGE_KEY, EMPTY_WRITER, normalizeWriterState);
}

function writerReducer(state, action) {
  switch (action.type) {
    case "CREATE_NOVEL":
      return createWriterNovel(state, action.novel, action.id, action.now);
    case "UPDATE_NOVEL":
      return updateWriterNovel(state, action.novelId, action.novel, action.now);
    case "DELETE_NOVEL":
      return deleteWriterNovel(state, action.novelId);
    case "ADD_CHAPTER":
      return addWriterChapter(state, action.novelId, action.chapter, action.id, action.now);
    case "UPDATE_CHAPTER":
      return updateWriterChapter(state, action.novelId, action.chapterId, action.chapter, action.now);
    case "DELETE_CHAPTER":
      return deleteWriterChapter(state, action.novelId, action.chapterId, action.now);
    default:
      throw new Error(`Unknown writer action: ${action.type}`);
  }
}

export function useWriterDispatch() {
  const [, update] = useWriterStore();
  return useCallback(
    (action) => update((state) => writerReducer(state, action)),
    [update],
  );
}
