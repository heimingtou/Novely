"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/components/auth/SessionProvider";

// Giữ API cũ ({ account, ready, signIn, signOut }) cho forum và bình luận trong trang đọc,
// nhưng dùng phiên đăng nhập thật thay vì localStorage.
export function useDemoSession() {
  const { user, ready, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const signIn = useCallback(() => router.push(`/auth?next=${encodeURIComponent(pathname || "/")}`), [router, pathname]);
  const account = user ? { id: String(user.id), name: user.username } : null;
  return { account, ready, signIn, signOut: logout };
}
