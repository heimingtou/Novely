"use client";

import { useLocalStorageState } from "@/lib/useLocalStorageState";
import { EMPTY_FORUM, FORUM_STORAGE_KEY, normalizeForumState } from "@/lib/forum-model.mjs";

export function useForumStore() {
  return useLocalStorageState(FORUM_STORAGE_KEY, EMPTY_FORUM, normalizeForumState);
}
