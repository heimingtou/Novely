"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, deleteSession } from "@/server/auth/session";

// Chỉ cho chuyển hướng về đường dẫn nội bộ (chống open redirect: ?next=https://site-xau.com).
function safeNext(value) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/auth") ? next : "/";
}

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Vui lòng nhập email hoặc tên đăng nhập.").max(255),
  password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(200),
});

const registerSchema = z.object({
  username: z.string().trim()
    .min(3, "Tên đăng nhập cần ít nhất 3 ký tự.")
    .max(50, "Tên đăng nhập tối đa 50 ký tự.")
    .regex(/^[a-zA-Z0-9_.]+$/, "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm và gạch dưới."),
  email: z.string().trim().toLowerCase().max(255).email("Địa chỉ email không hợp lệ."),
  password: z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự.").max(200, "Mật khẩu quá dài."),
  confirmPassword: z.string(),
  agreeTerms: z.literal("on", { message: "Vui lòng đồng ý với điều khoản sử dụng của Novely!" }),
}).refine((data) => data.password === data.confirmPassword, { message: "Mật khẩu xác nhận không khớp!", path: ["confirmPassword"] });

const firstIssue = (result) => result.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.";

export async function login(_prevState, formData) {
  const parsed = loginSchema.safeParse({ identifier: formData.get("identifier"), password: formData.get("password") });
  if (!parsed.success) return { error: firstIssue(parsed) };

  const { identifier, password } = parsed.data;
  const column = identifier.includes("@") ? "email" : "username";
  const { data: user, error } = await createAdminClient()
    .from("users")
    .select("user_id, role, password_hash")
    .eq(column, column === "email" ? identifier.toLowerCase() : identifier)
    .maybeSingle();
  if (error) {
    console.error("[auth] login", error);
    return { error: "Không thể đăng nhập lúc này, vui lòng thử lại." };
  }
  // Cùng một thông báo cho "sai tài khoản" và "sai mật khẩu".
  if (!(await verifyPassword(password, user?.password_hash))) {
    return { error: "Email/tên đăng nhập hoặc mật khẩu không đúng." };
  }

  await createSession(user, { remember: formData.get("rememberMe") === "on" });
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function register(_prevState, formData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(
    ["username", "email", "password", "confirmPassword", "agreeTerms"].map((key) => [key, formData.get(key) ?? undefined]),
  ));
  if (!parsed.success) return { error: firstIssue(parsed) };

  const { username, email, password } = parsed.data;
  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from("users")
    .insert({ username, email, password_hash: await hashPassword(password), role: "reader" })
    .select("user_id, role")
    .single();
  if (error) {
    if (error.code === "23505") {
      return { error: error.message.includes("email") ? "Email này đã được đăng ký." : "Tên đăng nhập đã có người dùng." };
    }
    console.error("[auth] register", error);
    return { error: "Không thể tạo tài khoản lúc này, vui lòng thử lại." };
  }
  const { error: profileError } = await supabase.from("profiles").insert({ user_id: user.user_id });
  if (profileError) console.error("[auth] create profile", profileError);

  await createSession(user);
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await deleteSession();
  revalidatePath("/", "layout");
}
