
import CardStory from '@/components/cardStory/cardStory';
import { faker } from '@faker-js/faker';
import './page.css'
import cardImg from '../../../public/CardStory.jpg'
import ListStory from '@/components/ListStory/ListStory';

export default async function Homepage(){
    const categories = [
        { id: 'cat-1', name: 'Trending' },
        { id: 'cat-2', name: 'For you' },
        { id: 'cat-3', name: 'Top rated' },
        { id: 'cat-4', name: 'Most Followed' },
        { id: 'cat-5', name: 'Mood Discovery' },
        { id: 'cat-6', name: 'Newly updated' },
        { id: 'cat-7', name: 'Surprise' },
    ];

    // Tạo dữ liệu giả: mỗi thể loại chứa một danh sách truyện riêng
    const fakeCategoriesData = categories.map((cat) => ({
        categoryId: cat.id,
        categoryName: cat.name,
        
        novels: Array.from({ length: 15 }, () => ({
            id: faker.string.uuid(),
            title: faker.book.title(),
            likes: (faker.number.float({ min: 0.5, max: 5.0, precision: 0.1 })).toFixed(1) + 'M',
            genres: cat.name + ' / Truyện Hay/fanfic',
            coverImage: cardImg,
        }))
    }));

    return(
        <div className='homeContaint'>          
            {fakeCategoriesData.map((cat)=>(
            <div key={cat.categoryId}>
                    <ListStory title={cat.categoryName} DataStory={cat.novels}/>
            </div>
            ))}
        </div>
        
    )
}