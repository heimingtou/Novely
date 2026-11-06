"use client";

import { useLocalStorageState } from "./useLocalStorageState";

// Navbar hiện chỉ mô phỏng đăng nhập. Thay hook này bằng phiên xác thực thật
// khi có backend; không dùng localStorage để kiểm tra quyền trên server.
const DEMO_ACCOUNT = { id: "demo-reader", name: "Bạn đọc Novely" };
const normalizeSession = (value) => value?.id === DEMO_ACCOUNT.id ? DEMO_ACCOUNT : null;

export function useDemoSession() {
  const [account, setAccount, ready] = useLocalStorageState("novely:v1:demo-session", null, normalizeSession);
  return { account, ready, signIn: () => setAccount(DEMO_ACCOUNT), signOut: () => setAccount(null) };
}
