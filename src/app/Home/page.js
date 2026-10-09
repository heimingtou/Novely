
import CardStory from '@/components/cardStory/cardStory';
import { faker } from '@faker-js/faker';
import './page.css'

export default async function Homepage(){
    const fakeNovels = Array.from({ length: 50 }, () => ({
        id: faker.string.uuid(),
        title: faker.book.title(), // Hoặc dùng faker.book.title()
        likes: (faker.number.float({ min: 0.5, max: 5.0, precision: 0.1 })).toFixed(1) + 'M', // Tạo số lượng like kiểu 1.2M
        genres: "Huyền huyễn / Mạo hiểm / Action",
        coverImage: faker.image.url(),
}));

console.log(fakeNovels);
    return(
        <div className='homeContaint'>
            <div className='cardContain'>
            {fakeNovels.map((novel) => (
                <CardStory
                    key={novel.id}
                    title={novel.title}
                    like={novel.likes}
                    genres={novel.genres}
                    coverImage={novel.coverImage}
                    isUp={novel.isUp}
                />
            ))}          
            </div>
        </div>
        
    )
}