import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

let adminClient;

// Client dùng SECRET KEY: bỏ qua RLS, CHỈ dùng ở server (services, Route Handlers).
// "server-only" khiến build báo lỗi nếu file này bị import vào Client Component.
// Vì bỏ qua RLS, mọi service phải tự lọc cột/điều kiện (không trả password_hash, email...).
export function createAdminClient() {
  if (!adminClient) {
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!secretKey) throw new Error("Thiếu SUPABASE_SECRET_KEY trong .env. Xem .env.example.");
    adminClient = createClient(getSupabaseEnv().url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}
