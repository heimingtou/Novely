// Nội dung demo do dự án tự soạn. Giữ nguyên id đoạn khi chỉnh sửa văn bản
// để bookmark, tiến độ và ghi chú vẫn trỏ về đúng đoạn.
export const novels = [
  {
    id: "demo",
    title: "Thư Viện Ánh Trăng",
    author: "Minh Thơ Hà",
    description: "Một thư viện bí ẩn chỉ mở cửa dưới ánh trăng. Mỗi cuốn sách đều chứa đựng một bí mật.",
    tags: ["Fantasy", "Mystery", "Adventure"],
    rating: 4.8,
    views: "12.4K",
    chapters: [
      {
        number: 1, title: "Cánh cửa lúc nửa đêm", date: "24/09/2026", isNew: false,
        paragraphs: [
          { id: "c1-con-pho", text: "Con phố cũ đã ngủ yên khi An bước xuống chuyến xe buýt cuối cùng. Những ngọn đèn vàng soi lên vỉa hè còn ướt, kéo chiếc bóng của cô dài đến tận góc đường. Trong túi áo, tấm bưu thiếp của bà ngoại khẽ cọ vào những ngón tay lạnh." },
          { id: "c1-buu-thiep", text: "Mặt trước tấm thiếp là một thư viện có cửa sổ hình trăng khuyết. Mặt sau chỉ có một câu viết bằng mực xanh: Nếu một ngày con không biết phải đi đâu, hãy tìm nơi những câu chuyện còn thức. An đã đọc câu ấy nhiều đến mức thuộc cả nét mực bị nhòe ở cuối dòng." },
          { id: "c1-con-hem", text: "Cô rẽ vào con hẻm nằm giữa tiệm sửa đồng hồ và một căn nhà bỏ trống. Ban chiều, nơi này kết thúc bằng bức tường phủ rêu. Nhưng lúc này, dưới vệt trăng rơi nghiêng, An nhìn thấy một cánh cửa gỗ màu xanh sẫm." },
          { id: "c1-tam-bien", text: "Trên cửa treo tấm biển nhỏ: Thư Viện Ánh Trăng. Những chữ cái bạc sáng lên như vừa được ai lau sạch. Không có giờ mở cửa, không có số điện thoại. Chỉ có một chiếc chuông đồng và dấu bàn tay mờ trên tay nắm." },
          { id: "c1-tieng-chuong", text: "An đưa tay chạm vào chiếc chuông. Âm thanh vang rất khẽ, vậy mà những tiếng động của thành phố lập tức lùi xa. Tiếng xe ngoài phố, tiếng nước từ mái hiên, cả tiếng giày của cô trên nền gạch đều tan vào một khoảng im lặng trong veo." },
          { id: "c1-mo-cua", text: "Cánh cửa mở vào phía trong. Mùi giấy cũ và hương gỗ thông tràn ra, ấm áp đến lạ. An bước qua ngưỡng cửa, nhìn thấy những giá sách cao chạm mái vòm. Trên trần, hàng nghìn đốm sáng nhỏ chuyển động chậm rãi như bầu trời đã được mang vào trong nhà." },
          { id: "c1-cau-hoi", text: "“Cháu đến trả sách hay tìm sách?” Một giọng nói vang lên từ quầy gỗ. Người phụ nữ đứng sau quầy đeo kính tròn, mái tóc bạc buộc gọn bằng sợi ruy băng màu lam. Bà nhìn An với vẻ bình thản của người đã chờ một vị khách từ rất lâu." },
          { id: "c1-tra-loi", text: "“Cháu cũng chưa biết nữa.” An đặt tấm bưu thiếp lên bàn. Người phụ nữ nhìn nét chữ, bàn tay chợt dừng trên cuốn sổ đang mở. Trong thoáng chốc, An tưởng mình thấy một nỗi buồn đi ngang qua đôi mắt ấy, nhanh như bóng mây che trăng." },
          { id: "c1-chiec-the", text: "Bà không hỏi thêm. Từ ngăn kéo, bà lấy ra một tấm thẻ bằng giấy dày, trên đó đã có tên An. Bên dưới tên là một khoảng trống và dòng chữ nhỏ: Mỗi độc giả được giữ một câu chuyện, nhưng không ai được giữ câu chuyện của người khác." },
          { id: "c1-loi-dan", text: "“Cháu có thể đọc bất cứ cuốn nào ở tầng một,” bà nói. “Nếu nghe thấy ai gọi tên mình từ trên cầu thang, đừng trả lời ngay. Trước tiên, hãy chắc rằng đó là giọng của một người cháu còn nhớ.” An quay nhìn cầu thang xoắn ốc ở cuối phòng." },
          { id: "c1-tieng-goi", text: "Từ khoảng tối trên cao, một tiếng cười rất quen khẽ vọng xuống. Đó là tiếng cười bà ngoại thường có mỗi lần kể sai đoạn kết rồi giả vờ quên mất. An siết chặt tấm thẻ. Cô đã không nghe tiếng cười ấy suốt ba năm, kể từ buổi chiều cuối cùng ở bệnh viện." },
          { id: "c1-trang-dau", text: "Trên giá sách gần nhất, một cuốn bìa trắng tự trượt ra. Nó rơi vào lòng bàn tay An, nhẹ như một phong thư. Trang đầu tiên không có tên tác giả. Chỉ có dòng chữ đang hiện dần dưới ánh trăng: Đêm nay, câu chuyện bắt đầu từ người trở về." },
        ],
      },
      {
        number: 2, title: "Người thủ thư bí ẩn", date: "26/09/2026", isNew: false,
        paragraphs: [
          { id: "c2-binh-minh", text: "An không biết mình đã đứng trước giá sách bao lâu. Khi ngẩng đầu, cô thấy người thủ thư đặt hai tách trà lên chiếc bàn cạnh cửa sổ. Ngoài lớp kính, mặt trăng vẫn ở nguyên vị trí cũ, còn những giọt mưa lơ lửng giữa không trung như những hạt cườm trong suốt." },
          { id: "c2-thoi-gian", text: "“Thời gian ở đây đi theo nhịp lật trang,” bà giải thích khi bắt gặp ánh nhìn của An. “Có người ngồi một đêm mà ngoài kia mới qua một phút. Có người chỉ ghé một phút nhưng mang theo cả một mùa hè.” Bà đẩy tách trà về phía ghế trống." },
          { id: "c2-ten-goi", text: "An ngồi xuống, để cuốn sách trắng trên đầu gối. “Cháu nên gọi bà là gì?” Người phụ nữ im lặng một lát rồi mỉm cười. “Cứ gọi ta là người thủ thư. Những cái tên ở đây đôi khi dẫn người ta đi xa hơn dự định.”" },
          { id: "c2-nguoi-quen", text: "“Bà biết bà ngoại cháu phải không?” Lần này, người thủ thư không tránh câu hỏi. Bà kể rằng nhiều năm trước, có một cô gái thường đến thư viện để đọc những cuốn sách về biển. Cô gái ấy luôn trả sách đúng hẹn, trừ một cuốn duy nhất." },
          { id: "c2-cuon-muon", text: "“Cuốn sách đó viết về điều gì?” An hỏi. Người thủ thư nhìn ra cửa sổ. “Về một lời hứa. Nhưng không phải lời hứa nào cũng được viết ra khi người ta còn đủ can đảm để thực hiện.” Hơi trà bốc lên, che mờ đôi kính tròn trong vài giây." },
          { id: "c2-ngan-keo", text: "Bà lấy từ ngăn bàn một phong bì đã ngả màu. Bên trong là phiếu mượn sách mang tên bà ngoại An. Ngày trả bị gạch đi rồi viết lại nhiều lần. Ở mép giấy có hình một con thuyền nhỏ, giống hệt những hình bà từng vẽ lên góc vở của cô." },
          { id: "c2-loi-hua", text: "An nhớ đến chiếc hộp thiếc dưới gầm giường cũ. Trong hộp là vỏ sò, một chiếc vé tàu và bức ảnh đã mất nửa bên phải. Cô từng nghĩ đó chỉ là những món đồ bà giữ vì tiếc. Giờ đây, mỗi món dường như đang chờ được gọi đúng tên." },
          { id: "c2-quy-tac", text: "Người thủ thư đặt một ngón tay lên phiếu mượn. “Thư viện có thể cho cháu đọc điều đã xảy ra. Nó không hứa sẽ cho cháu thay đổi điều đó. Nếu cháu mở một cánh cửa chỉ để xóa nỗi buồn của mình, có thể cháu sẽ lấy mất niềm vui của người khác.”" },
          { id: "c2-ban-do", text: "Từ giữa cuốn sách trắng, một tờ giấy gấp tư rơi xuống. Đó là bản đồ thư viện, nhưng các căn phòng không được ghi bằng số. Chúng mang những cái tên lạ: Điều Chưa Nói, Ngày Mai Bỏ Quên, Mùa Hè Không Trở Lại. Ở góc dưới, một chấm sáng nhấp nháy cạnh chữ Biển." },
          { id: "c2-buoc-chan", text: "Tiếng bước chân vang lên trên cầu thang. An quay lại, lần này không còn nghe tiếng bà ngoại. Một cậu bé mặc áo mưa vàng đứng ở chiếu nghỉ, hai tay ôm chiếc hộp gỗ. Cậu nhìn cô, rồi nhìn cuốn sách, nét mặt vừa mừng rỡ vừa lo lắng." },
          { id: "c2-loi-nhan", text: "“Chị đến muộn rồi,” cậu bé nói. “Nhưng chắc vẫn còn kịp.” Người thủ thư đứng dậy, kéo chiếc đồng hồ cát trên quầy về phía mình. Trong bầu thủy tinh, những hạt cát bạc bắt đầu rơi, dù trước đó An chắc chắn nó hoàn toàn trống rỗng." },
          { id: "c2-hanh-lang", text: "Cậu bé dẫn An đến hành lang phía sau giá sách. Ở cuối hành lang có tiếng sóng vỗ. Trước khi bước vào, An ngoái lại. Người thủ thư vẫn đứng cạnh bàn trà, một tay đặt lên chiếc ghế trống, như thể bà đang giữ chỗ cho người khách tiếp theo." },
        ],
      },
      {
        number: 3, title: "Cuốn sách không tên", date: "28/09/2026", isNew: true,
        paragraphs: [
          { id: "c3-bo-bien", text: "Hành lang kết thúc trên một bãi biển phủ sương. An vẫn cảm thấy nền gỗ dưới chân, nhưng trước mắt cô là mặt nước trải dài đến tận chân trời. Những ngọn sóng không phát sáng; chúng mang màu xanh thẫm của một ký ức vừa được đánh thức." },
          { id: "c3-cau-be", text: "Cậu bé áo vàng ngồi xuống cạnh một chiếc thuyền úp. “Em là người giữ trang,” cậu nói. “Mỗi khi một câu chuyện thiếu đoạn kết, sẽ có ai đó phải ở lại để nó không bị gió cuốn đi.” Cậu đặt chiếc hộp gỗ lên cát và mở nắp." },
          { id: "c3-chiec-hop", text: "Trong hộp không có đồ vật nào. Chỉ có một khoảng sáng nhỏ, lay động như ngọn lửa. Khi An cúi nhìn, cô thấy hình ảnh bà ngoại thời trẻ đứng trên sân ga, tay cầm một cuốn sách bìa trắng. Một người ở phía bên kia đường ray đang vẫy chào." },
          { id: "c3-san-ga", text: "Tiếng còi tàu vọng lên từ mặt biển. Cảnh vật đổi khác, bãi cát trở thành sân ga lát gạch đỏ. An nhận ra chiếc đồng hồ lớn trong bức ảnh cũ. Kim phút dừng ở số mười một, đúng như lúc cô từng nhìn thấy trên mặt sau chiếc vé tàu." },
          { id: "c3-la-thu", text: "Trên băng ghế có một lá thư chưa dán tem. An đọc dòng đầu, rồi dừng lại. Lá thư không gửi cho người đã lên tàu. Nó gửi cho chính cô, một người còn chưa ra đời ở thời điểm ấy. Nét chữ xanh nghiêng nhẹ về bên phải, thân thuộc đến nhói lòng." },
          { id: "c3-noi-dung", text: "“An thân yêu, nếu con đọc được những dòng này, có lẽ bà đã không kịp kể hết. Người lớn thường nói rằng mình còn nhiều thời gian. Bà cũng từng tin như vậy, cho đến khi hiểu rằng một lời hỏi thăm để dành quá lâu có thể trở thành một điều không bao giờ nói được.”" },
          { id: "c3-ky-uc", text: "An ngồi xuống. Cô nhớ những cuộc gọi mình đã bỏ lỡ vì bận học, nhớ lời hẹn về thăm bị dời sang tuần sau. Bấy lâu nay, cô giữ những điều ấy như những viên đá trong túi, nghĩ rằng mang chúng đủ lâu sẽ chứng minh mình chưa quên." },
          { id: "c3-trang-trong", text: "Cuốn sách mở ra một trang trống. Cậu bé đưa cho cô cây bút. “Chị không thể viết lại chuyến tàu,” cậu nói. “Nhưng chị có thể viết điều mình muốn mang về.” An nhìn đường ray kéo dài vào sương. Lần đầu tiên trong đêm, cô không muốn chạy theo một giọng nói." },
          { id: "c3-dieu-viet", text: "Cô viết về bát canh đặt sẵn trên bàn, về bàn tay đan lại chiếc khăn bị tuột len, về những câu chuyện có đoạn kết thay đổi mỗi tối. Cô viết chậm, để từng điều nhỏ bé tìm được chỗ đứng ngoài nỗi mất mát. Mực không biến mất như cô từng lo." },
          { id: "c3-tam-biet", text: "Khi An đặt bút xuống, người trên sân ga quay lại. Bà ngoại không bước đến, chỉ mỉm cười và giơ tay chào. Tiếng còi tàu vang lần nữa, dịu hơn. An cũng giơ tay. Có những lời tạm biệt không đóng lại một cánh cửa; chúng giúp người ở lại tìm thấy đường về." },
          { id: "c3-tro-ve", text: "Mùi trà đưa cô trở lại thư viện. Ngoài cửa sổ, giọt mưa cuối cùng chạm xuống bậu gỗ. Người thủ thư nhận cuốn sách, đặt phiếu mượn vào trong rồi đóng bìa. Trên bìa trắng, một cái tên hiện ra: Những Điều Được Giữ Lại. An chợt hiểu vì sao trước đó nó chưa có tên." },
          { id: "c3-binh-minh", text: "Khi bước ra con hẻm, An nghe tiếng thành phố thức dậy. Tấm thẻ thư viện vẫn nằm trong túi áo, ấm dưới lòng bàn tay. Ở mặt sau, một dòng chữ mới hiện lên: Hẹn gặp lại khi con có một câu chuyện để kể. Phía cuối phố, bình minh đang mở trang đầu tiên." },
        ],
      },
    ],
  },
];

export function getNovel(id) {
  return novels.find((novel) => novel.id === id);
}

export function getChapter(novel, number) {
  // Không chấp nhận các URL như 1abc, 1.5 hoặc 01.
  return novel?.chapters.find((chapter) => String(chapter.number) === String(number));
}

export function chapterHref(novelId, chapterNumber) {
  return `/novels/${encodeURIComponent(novelId)}/chapters/${chapterNumber}`;
}
