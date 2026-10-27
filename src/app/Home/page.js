
import { getServerI18n } from "@/lib/i18n/server";

import CardStory from '@/components/cardStory/cardStory';
import { faker } from '@faker-js/faker';
import './page.css'
import cardImg from '../../../public/CardStory.jpg'
import ListStory from '@/components/ListStory/ListStory';

export default async function Homepage(){
  const { t, locale } = await getServerI18n();
    const categories = [
        { id: 'cat-1', name: t("Trending") },
        { id: 'cat-2', name: t("For you") },
        { id: 'cat-3', name: t("Top rated") },
        { id: 'cat-4', name: t("Most Followed") },
        { id: 'cat-5', name: t("Mood Discovery") },
        { id: 'cat-6', name: t("Newly updated") },
        { id: 'cat-7', name: t("Surprise") },
    ];

    // Tạo dữ liệu giả: mỗi thể loại chứa một danh sách truyện riêng
    const fakeCategoriesData = categories.map((cat) => ({
        categoryId: cat.id,
        categoryName: cat.name,
        
        novels: Array.from({ length: 15 }, () => ({
            id: faker.string.uuid(),
            title: faker.book.title(),
            likes: (faker.number.float({ min: 0.5, max: 5.0, precision: 0.1 })).toFixed(1) + 'M',
            genres: cat.name,
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