"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logout as logoutAction } from "@/app/auth/actions";

// Trạng thái đăng nhập phía client. Nguồn sự thật là cookie httpOnly trên server:
// layout đọc phiên và truyền `user` xuống đây. Mọi thay đổi (đăng nhập/đăng xuất)
// đều đi qua Server Action rồi làm mới layout, nên các component luôn thấy cùng một trạng thái.
const SessionContext = createContext({ user: null, ready: true, logout: async () => {}, pending: false });
const CHANNEL = "novely-auth";

export function SessionProvider({ user, children }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const userId = user?.id ?? null;
  const expiresAt = user?.expiresAt ?? null;

  // Đồng bộ giữa các tab: tab nào đổi người dùng thì báo cho các tab khác làm mới.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => {
      if (event.data?.userId !== userId) router.refresh();
    };
    channel.postMessage({ userId });
    return () => channel.close();
  }, [userId, router]);

  // Token hết hạn: làm mới để giao diện chuyển về trạng thái chưa đăng nhập.
  useEffect(() => {
    if (!expiresAt) return;
    const delay = Math.min(expiresAt - Date.now() + 1000, 2 ** 31 - 1);
    const timer = setTimeout(() => router.refresh(), Math.max(delay, 0));
    const onVisible = () => { if (document.visibilityState === "visible" && Date.now() >= expiresAt) router.refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [expiresAt, router]);

  const logout = useCallback(() => new Promise((resolve) => {
    startTransition(async () => {
      await logoutAction();
      router.refresh();
      resolve();
    });
  }), [router]);

  const value = useMemo(() => ({ user, ready: true, logout, pending }), [user, logout, pending]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
