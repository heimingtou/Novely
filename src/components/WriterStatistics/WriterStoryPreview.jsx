import Image from "next/image";
import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";

export default async function WriterStoryPreview({ story }) {
  const { t } = await getServerI18n();
  return <section className="mx-auto w-full max-w-3xl px-6 py-10">
    <h1 className="text-2xl font-bold">{story.title}</h1>
    <div className="my-6 flex flex-wrap items-start gap-6 rounded-xl border border-border bg-card p-6">
      <Image src={story.img} width={160} height={224} alt={story.title} />
      <div><h2 className="text-xl font-semibold">{t("Chi tiết truyện")}</h2><p className="my-3">{t("Số chương đã đăng: {0}", [story.current_chap])}</p><p>{story.view} {t("lượt xem")}</p></div>
    </div>
    <p>{t("Thông tin tác phẩm mẫu. Nội dung chương chưa được cung cấp trong bản demo này.")}</p>
    <Link className="mt-6 inline-block rounded-lg bg-primary px-5 py-3 text-white" href="/Writer">{t("Trở về danh sách truyện")}</Link>
  </section>;
}
