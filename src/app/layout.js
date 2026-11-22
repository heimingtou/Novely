import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "@/components/navbar/navbar";
import { ThemeManager } from "@/components/theme/SiteTheme";
import { LocaleProvider, SiteFooter } from "@/components/i18n/LocaleProvider";
import { getServerI18n, getServerLocale } from "@/lib/i18n/server";
import { listGenres } from "@/server/services/genres";
import { getCurrentUser } from "@/server/auth/dal";
import { SessionProvider } from "@/components/auth/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata() {
  const { t } = await getServerI18n();
  return { title: "Novely", description: `Novely — ${t("noi khoi nguon cua nhung cau truyen")}` };
}

export default async function RootLayout({ children }) {
  const locale = await getServerLocale();
  // Lỗi database không được làm sập toàn bộ trang: navbar chỉ mất danh sách thể loại.
  const [genres, user] = await Promise.all([
    listGenres().catch((error) => {
      console.error("[layout] genres", error);
      return [];
    }),
    // Lỗi đọc phiên => coi như chưa đăng nhập, không làm sập trang.
    getCurrentUser().catch((error) => {
      console.error("[layout] session", error);
      return null;
    }),
  ]);
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
       <body className="min-h-full flex flex-col">
        <Script src="/theme-bootstrap.js" strategy="beforeInteractive" />
        <LocaleProvider initialLocale={locale}>
          <SessionProvider user={user}>
            <ThemeManager />
            <Navbar genres={genres} />
            <main className="min-h-full flex flex-col mt-[5rem]">{children}</main>
            <SiteFooter />
          </SessionProvider>
        </LocaleProvider>
       </body>
       
       
    </html>
  );
}
