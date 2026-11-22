
import { getServerI18n } from "@/lib/i18n/server";

import HeroCarousel from '@/components/home/HeroCarousel';
import './page.css'
import ListStory from '@/components/ListStory/ListStory';
import { getHomeSections } from '@/server/services/catalog';

export default async function Homepage(){
    const { t, locale } = await getServerI18n();
    const sections = await getHomeSections();

    // Ảnh nền ngang của carousel vẫn dùng ảnh có sẵn; nội dung lấy từ truyện thịnh hành.
    const featuredStories = sections[0].items.slice(0, 5).map((novel, index) => ({
        id: novel.id,
        title: novel.title,
        description: novel.description,
        likes: novel.hearts,
        genres: novel.genres,
        href: `/novels/${novel.id}`,
        image: `/CardStorys${index + 1}.jpg`,
    }));

    return(
        <div className='homeContaint'>
            {featuredStories.length > 0 && <HeroCarousel slides={featuredStories} locale={locale} />}
            {sections.filter((section) => section.items.length).map((section)=>(
            <div key={section.key}>
                    <ListStory title={t(section.title)} DataStory={section.items}/>
            </div>
            ))}
        </div>

    )
}
