import Link from "next/link";

export default function NovelNotFound() {
  return <section className="mx-auto max-w-xl px-6 py-20 text-center" lang="vi"><h1 className="text-2xl font-bold">Không tìm thấy truyện hoặc chương</h1><p className="my-5">Đường dẫn có thể chưa đúng hoặc chương chưa được cập nhật.</p><Link href="/novels/demo" className="inline-block rounded-xl bg-primary px-5 py-3 text-white">Về truyện demo</Link></section>;
}
