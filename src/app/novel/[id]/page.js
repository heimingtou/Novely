import CardStory from "@/components/cardStory/cardStory";
import { faker } from '@faker-js/faker';
import './page.css'

export default async function NovelDetailPage({ params }) {
  const { id } = await params;

   const categories = [
    "Ngôn Tình",
    "Đam Mỹ",
    "Bách Hợp",
    "Tiên Hiệp",
    "Kiếm Hiệp",
    "Huyền Huyễn",
    "Đô Thị",
    "Khoa Huyễn",
    "Trọng Sinh",
    "Xuyên Không",
    "Hệ Thống",
    "Trinh Thám",
    "Kinh Dị",
    "Hài Hước",
    "Trường Học",
    "Cổ Đại",
    "Mạt Thế",
    "Dinh Dưỡng",
    "Võ Luyện",
    "Lịch Sử"
];

  const fakeCategoriesData = categories.map((cat,index) => ({
        categoryId: index,
        categoryName: cat,
        
        novels: Array.from({ length: 15 }, () => ({
            id: faker.string.uuid(),
            title: faker.book.title(),
            likes: (faker.number.float({ min: 0.5, max: 5.0, precision: 0.1 })).toFixed(1) + 'M',
            genres: cat + ' / Truyện Hay/fanfic',
            coverImage: faker.image.url(),
        }))
    }));
  
  // Tìm truyện khớp với id trên URL
 const decodedId = decodeURIComponent(id);
  const matchedCategory = fakeCategoriesData.find(
    cat => cat.categoryName.toLowerCase() === decodedId.toLowerCase()
  );

  // 2. Lấy ra mảng các truyện thuộc thể loại đó (nếu tìm thấy thì trả về mảng novels, ngược lại trả về mảng rỗng [])
  const novelsInCategory = matchedCategory ? matchedCategory.novels: [];
  return (
    
    <div className="">
      <div className="ContaintGenre">
        <h1 className="Genre">{decodedId}</h1>
      <div className="gridContain">
        {
        novelsInCategory&&(
          novelsInCategory.map((novel)=>(
             <CardStory key={novel.id} title={novel.title}
          like={novel.likes}
          genres={novel.genres}
          coverImage={novel.coverImage}
          />
          ))
         
        )
       }
      </div>
      </div>
      
       
    </div>
  );
}