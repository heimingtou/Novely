"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

let browserClient;

// Supabase client cho Client Components. Dùng chung một instance trên trình duyệt.
export function createClient() {
  if (!browserClient) {
    const { url, publishableKey } = getSupabaseEnv();
    browserClient = createBrowserClient(url, publishableKey);
  }
  return browserClient;
}
