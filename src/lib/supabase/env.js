// Đọc và kiểm tra biến môi trường Supabase. Biến NEXT_PUBLIC_* được Next.js
// nhúng vào bundle trình duyệt, nên phải truy cập trực tiếp theo tên (không
// dùng process.env[key]) để Next.js thay thế được lúc build.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY trong .env. Xem .env.example.",
    );
  }

  return { url, publishableKey };
}
