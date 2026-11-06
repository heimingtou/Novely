import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar/navbar";
import { ThemeManager } from "@/components/theme/SiteTheme";
import { themeBootstrap } from "@/lib/theme-bootstrap.mjs";
import { LocaleProvider, SiteFooter } from "@/components/i18n/LocaleProvider";
import { getServerI18n, getServerLocale } from "@/lib/i18n/server";

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
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
       <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
       <body className="min-h-full flex flex-col">
        <LocaleProvider initialLocale={locale}>
          <ThemeManager />
          <Navbar/>
          <main className="min-h-full flex flex-col">{children}</main>
          <SiteFooter />
        </LocaleProvider>
       </body>
       
       
    </html>
  );
}
