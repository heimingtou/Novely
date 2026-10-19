
import ChapterList from "@/components/novel-detail/ChapterList";
import NovelActions from "@/components/novel-detail/NovelActions";

// Dữ liệu mẫu của truyện
const novel = {
  id: "demo",
  title: "Thư Viện Ánh Trăng",
  author: "Minh Thơ Hà",
  description:
    "Một thư viện bí ẩn chỉ mở cửa dưới ánh trăng. " +
    "Mỗi cuốn sách đều chứa đựng một bí mật.",
  tags: ["Fantasy", "Mystery", "Adventure"],
  rating: 4.8,
  views: "12.4K",
};

// Dữ liệu mẫu của các chương
const chapters = [
  {
    number: 1,
    title: "Cánh cửa lúc nửa đêm",
    date: "24/09/2026",
    isNew: false,
  },
  {
    number: 2,
    title: "Người thủ thư bí ẩn",
    date: "26/09/2026",
    isNew: false,
  },
  {
    number: 3,
    title: "Cuốn sách không tên",
    date: "28/09/2026",
    isNew: true,
  },
];

// Component chính của trang
export default async function NovelDetailPage({ params }) {
  const { id } = await params;

  if (id !== novel.id) {
    return <h1>Không tìm thấy truyện!</h1>;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">

      <h1 className="mb-6 text-3xl font-bold">
        Chi tiết truyện
      </h1>

      {/* Thông tin truyện */}
      <section className="grid gap-8 rounded-2xl border border-gray-200 p-6 md:grid-cols-[200px_1fr]">

        {/* Bìa truyện */}
        <div className="flex h-72 items-center justify-center rounded-xl bg-gradient-to-br from-purple-800 to-pink-500 text-6xl text-white">
          ✦
        </div>

        {/* Tên và mô tả */}
        <div>
          <h2 className="text-2xl font-bold">
            {novel.title}
          </h2>

          <p className="mt-2">
            Tác giả: {novel.author}
          </p>

          <p className="mt-5 leading-7">
            {novel.description}
          </p>

          {/* Thể loại */}
          <div className="mt-5 flex flex-wrap gap-2">
            {novel.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-600"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Thống kê */}
          <div className="mt-5 flex gap-6">
            <p>⭐ {novel.rating}/5</p>
            <p>👁 {novel.views} lượt xem</p>
          </div>
        </div>
      </section>

      {/* Danh sách chương */}
      <ChapterList chapters={chapters} />

      {/* Library và Share */}
      <NovelActions novelTitle={novel.title} />

      {/* Danh sách chương */}
      <ChapterList chapters={chapters} />

    </main>
  );
}
