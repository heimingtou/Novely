import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNoDbError } from "@/server/http";

export async function listGenres() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("genres").select("genre_id, name, slug").order("name", { ascending: true });
  assertNoDbError(error);
  return data;
}
