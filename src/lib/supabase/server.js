import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// Supabase client cho Server Components, Route Handlers và Server Actions.
// Tạo mới mỗi request vì client gắn với cookie của request đó.
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component không được ghi cookie; bỏ qua vì Route Handler
          // hoặc proxy sẽ làm mới phiên khi cần.
        }
      },
    },
  });
}
