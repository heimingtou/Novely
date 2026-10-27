
import { getServerI18n } from "@/lib/i18n/server";
import Homepage from "./Home/page";

export default async function Home() {
  const { t, locale } = await getServerI18n();
  return (
  <main className="min-h-screen bg-background text-foreground">
    <Homepage/>
  <p className="text-center text-muted mt-2">{t("Đang xây dựng giao diện đồ án...")}</p>
</main>
  );
}