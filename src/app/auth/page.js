import { redirect } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/server/auth/dal";

export const metadata = { title: "Đăng nhập | Novely" };

const safeNext = (value) => (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/auth") ? value : "/");

export default async function AuthPage({ searchParams }) {
  const next = safeNext((await searchParams).next);
  // Đã đăng nhập thì không cần ở trang này nữa.
  if (await getCurrentUser()) redirect(next);
  return <AuthForm next={next} />;
}
