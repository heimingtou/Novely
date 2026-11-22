import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNoDbError, notFound } from "@/server/http";

// Hồ sơ công khai: tuyệt đối không chọn password_hash, email, phone_number, birthday.
const PUBLIC_PROFILE = "user_id, username, role, level, created_at, profile:profiles(avatar, bio, fb_link)";

export async function getPublicProfile(idOrUsername) {
  const supabase = createAdminClient();
  const column = /^\d+$/.test(idOrUsername) ? "user_id" : "username";
  const { data, error } = await supabase.from("users").select(PUBLIC_PROFILE).eq(column, idOrUsername).maybeSingle();
  assertNoDbError(error);
  if (!data) throw notFound("Không tìm thấy người dùng");

  const { data: novels, error: novelsError } = await supabase
    .from("novels")
    .select("novel_id, title, slug, cover_url, status, count_chapter, last_chapter_at")
    .eq("author_id", data.user_id)
    .eq("published", true)
    .order("last_chapter_at", { ascending: false, nullsFirst: false });
  assertNoDbError(novelsError);

  return { ...data, novels };
}
