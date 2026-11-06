export const FORUM_CATEGORIES = [
  { id: "novel-discussion", name: "Novel Discussion", label: "Thảo luận truyện", icon: "book", description: "Cùng nói về những trang sách khiến bạn nhớ mãi." },
  { id: "theory", name: "Theory", label: "Giả thuyết", icon: "brain", description: "Một chi tiết nhỏ, một cách nhìn hoàn toàn mới." },
  { id: "writer-corner", name: "Writer Corner", label: "Góc tác giả", icon: "pen", description: "Chia sẻ hành trình viết và những điều phía sau câu chữ." },
  { id: "find-a-novel", name: "Find a Novel", label: "Tìm truyện", icon: "search", description: "Tìm lại một câu chuyện, khám phá một cuốn sách mới." },
  { id: "promote-your-novel", name: "Promote Your Novel", label: "Giới thiệu tác phẩm", icon: "megaphone", description: "Giới thiệu câu chuyện bạn đã dành tâm huyết để viết." },
  { id: "creative-corner", name: "Creative Corner", label: "Góc sáng tạo", icon: "palette", description: "Những sáng tạo được khơi nguồn từ trang sách." },
  { id: "general", name: "General", label: "Chuyện trò", icon: "chat", description: "Một chỗ ngồi nhỏ cho những người thích đọc." },
  { id: "help", name: "Help", label: "Hỏi đáp", icon: "help", description: "Hỏi một câu, cùng tìm một lời giải." },
];

// Các tài khoản, bài viết và số liệu dưới đây đều là dữ liệu minh họa tự soạn.
export const FORUM_POSTS = [
  {
    id: "thu-vien-nhung-dieu-giu-lai", authorId: "seed-minh-an", authorName: "Minh An", category: "novel-discussion", novelId: "demo",
    title: "Có những cuốn sách đến đúng lúc mình cần nhất",
    body: "Mình vừa đọc xong ba chương đầu của Thư Viện Ánh Trăng. Điều mình thích nhất là không khí rất yên, dù câu chuyện vẫn có nhiều bí ẩn.\n\nCó ai cũng thường giữ lại một câu văn rồi quay lại đọc vào những ngày mệt mỏi không? Chia sẻ cùng mình một câu chuyện đã từng giúp bạn thấy nhẹ lòng hơn nhé.",
    spoiler: false, createdAt: "2026-10-21T02:15:00.000Z", likes: 42, views: 368,
  },
  {
    id: "nguoi-thu-thu-la-ai", authorId: "seed-ha-linh", authorName: "Hà Linh", category: "theory", novelId: "demo",
    title: "Người thủ thư có đang chờ một độc giả khác?",
    body: "Ở cuối chương 2, người thủ thư đặt tay lên chiếc ghế trống. Mình nghĩ chi tiết ấy liên quan đến cô gái từng mượn sách về biển.\n\nLiệu thư viện không chỉ giữ ký ức của độc giả, mà chính người thủ thư cũng đang ở lại vì một lời hứa? Muốn nghe cách mọi người nối các chi tiết này với nhau!",
    spoiler: true, createdAt: "2026-10-21T03:30:00.000Z", likes: 31, views: 254,
  },
  {
    id: "mot-trang-moi-moi-ngay", authorId: "seed-quynh-chi", authorName: "Quỳnh Chi", category: "writer-corner", novelId: null,
    title: "Mọi người vượt qua những ngày không viết được như thế nào?",
    body: "Mình đang thử thói quen viết 200 từ mỗi sáng, không sửa trong lúc viết. Có hôm chỉ viết được một đoạn hội thoại, nhưng cảm giác vẫn tốt hơn việc chờ đến khi có một ý tưởng thật hoàn hảo.\n\nBạn có một nghi thức nhỏ nào để bắt đầu viết không?",
    spoiler: false, createdAt: "2026-10-20T12:10:00.000Z", likes: 24, views: 187,
  },
  {
    id: "tim-truyen-hieu-sach", authorId: "seed-nam-phong", authorName: "Nam Phong", category: "find-a-novel", novelId: null,
    title: "Tìm truyện có một hiệu sách mở cửa vào ngày mưa",
    body: "Mình từng đọc một truyện chữ kể về cô gái quay về thị trấn cũ và trông một hiệu sách nhỏ. Có chi tiết khách đến mua sách được tặng kèm một tấm thiệp viết tay.\n\nMình không nhớ tên tác giả. Ai có gợi ý truyện cùng không khí nhẹ nhàng như vậy cũng giới thiệu giúp mình với!",
    spoiler: false, createdAt: "2026-10-21T04:00:00.000Z", likes: 9, views: 76,
  },
  {
    id: "gioi-thieu-ban-thao-mua-ha", authorId: "seed-mai-khoi", authorName: "Mai Khôi", category: "promote-your-novel", novelId: null,
    title: "Mình vừa viết xong bản thảo đầu tiên của một truyện ngắn",
    body: "Truyện kể về hai người bạn viết thư cho nhau qua ngăn kéo của một chiếc bàn học cũ. Mình muốn thử kể một câu chuyện nhỏ, không quá nhiều nhân vật, chỉ có những điều ngại nói thành lời.\n\nCó tác giả mới nào muốn cùng trao đổi kinh nghiệm hoàn thành bản thảo không?",
    spoiler: false, createdAt: "2026-10-19T08:00:00.000Z", likes: 17, views: 122,
  },
  {
    id: "bang-mau-anh-trang", authorId: "seed-bao-ngoc", authorName: "Bảo Ngọc", category: "creative-corner", novelId: "demo",
    title: "Nếu vẽ một thư viện dưới ánh trăng, bạn sẽ chọn màu gì?",
    body: "Mình đang làm một bảng màu lấy cảm hứng từ Thư Viện Ánh Trăng: xanh mực cho những giá sách, vàng ấm cho bàn trà và một chút bạc ở cửa sổ.\n\nMọi người hình dung căn phòng trong truyện trông như thế nào? Mình thích việc mỗi độc giả lại có một thư viện riêng trong trí tưởng tượng.",
    spoiler: false, createdAt: "2026-10-20T14:40:00.000Z", likes: 28, views: 194,
  },
  {
    id: "doc-sach-buoi-sang", authorId: "seed-thao-nguyen", authorName: "Thảo Nguyên", category: "general", novelId: null,
    title: "Đọc vài trang trước khi cầm điện thoại là một thói quen đáng thử",
    body: "Mình đặt mục tiêu nhỏ thôi: mười phút đọc vào buổi sáng, trước khi xem thông báo. Sau một tuần, mình thấy dễ tập trung hơn và cũng bớt cảm giác phải đọc thật nhanh.\n\nMọi người thường dành thời gian đọc vào lúc nào trong ngày?",
    spoiler: false, createdAt: "2026-10-21T05:20:00.000Z", likes: 19, views: 141,
  },
  {
    id: "cach-luu-doan-van", authorId: "seed-duc-anh", authorName: "Đức Anh", category: "help", novelId: "demo",
    title: "Làm sao để lưu lại một đoạn văn mình thích?",
    body: "Mình thấy trang đọc có mục My Clipping nhưng chưa rõ cách sử dụng. Có phải chỉ cần chọn đoạn văn rồi bấm Highlight là lần sau vẫn xem lại được không? Cảm ơn mọi người!",
    spoiler: false, createdAt: "2026-10-21T06:05:00.000Z", likes: 7, views: 63,
  },
  {
    id: "y-nghia-tam-the", authorId: "seed-thanh-ha", authorName: "Thanh Hà", category: "theory", novelId: "demo",
    title: "Một câu trên tấm thẻ thư viện khiến mình nghĩ mãi",
    body: "Mỗi độc giả được giữ một câu chuyện, nhưng không ai được giữ câu chuyện của người khác. Mình hiểu câu này là lời nhắc rằng chúng ta có thể đồng hành với ai đó, nhưng không thể quyết định thay cách họ bước tiếp.\n\nCó thể mình đang nghĩ hơi xa, nhưng rất muốn nghe một cách hiểu khác.",
    spoiler: true, createdAt: "2026-10-20T09:25:00.000Z", likes: 36, views: 297,
  },
  {
    id: "ban-dong-hanh-doc-sach", authorId: "seed-gia-han", authorName: "Gia Hân", category: "general", novelId: null,
    title: "Một góc nhỏ để kể về cuốn sách bạn đang đọc",
    body: "Không cần review dài hay chấm điểm đâu. Chỉ cần một cái tên và một lý do bạn vẫn muốn lật sang trang tiếp theo.\n\nMình bắt đầu nhé: đang đọc một tập tản văn về những chuyến tàu, vì mỗi câu chuyện đều làm mình muốn đi chậm hơn một chút.",
    spoiler: false, createdAt: "2026-10-18T11:00:00.000Z", likes: 52, views: 441,
  },
];

export const FORUM_COMMENTS = {
  "thu-vien-nhung-dieu-giu-lai": [
    { id: "seed-c1", authorId: "seed-bao-ngoc", authorName: "Bảo Ngọc", body: "Mình cũng thích không khí bàn trà và ánh trăng. Đọc chậm một chút lại thấy nhiều chi tiết hay hơn.", spoiler: false, createdAt: "2026-10-21T02:40:00.000Z" },
    { id: "seed-c2", authorId: "seed-ha-linh", authorName: "Hà Linh", body: "Với mình là những câu chuyện có một nhân vật biết lắng nghe. Đôi khi chỉ cần vậy thôi.", spoiler: false, createdAt: "2026-10-21T03:00:00.000Z" },
  ],
  "nguoi-thu-thu-la-ai": [
    { id: "seed-c3", authorId: "seed-thanh-ha", authorName: "Thanh Hà", body: "Mình nghĩ chiếc ghế được giữ cho người từng hứa quay lại trả cuốn sách về biển.", spoiler: true, createdAt: "2026-10-21T04:00:00.000Z" },
  ],
  "cach-luu-doan-van": [
    { id: "seed-c4", authorId: "seed-minh-an", authorName: "Minh An", body: "Đúng rồi, chọn chữ trong một đoạn rồi bấm Highlight. Mở My Clipping trên thanh công cụ để xem lại nhé. Dữ liệu hiện được lưu trên trình duyệt bạn dùng.", spoiler: false, createdAt: "2026-10-21T06:20:00.000Z" },
  ],
};
