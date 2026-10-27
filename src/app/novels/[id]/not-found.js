
import { getServerI18n } from "@/lib/i18n/server";
import Link from "next/link";

export default async function NovelNotFound() {
  const { t, locale } = await getServerI18n();
  return <section className="mx-auto max-w-xl px-6 py-20 text-center" lang={locale}><h1 className="text-2xl font-bold">{t("Không tìm thấy truyện hoặc chương")}</h1><p className="my-5">{t("Đường dẫn có thể chưa đúng hoặc chương chưa được cập nhật.")}</p><Link href="/novels/demo" className="inline-block rounded-xl bg-primary px-5 py-3 text-white">{t("Về truyện demo")}</Link></section>;
}
