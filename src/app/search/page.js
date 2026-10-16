"use client";
import { SearchIcon } from "lucide-react";
import './page.css';
import { useState, useEffect } from "react";
import { faker } from "@faker-js/faker";
import CardStory from "@/components/cardStory/cardStory";
import cardImg from '../../../public/CardStory.jpg'
export default function SearchPage() {
    const [textInput, setTextInput] = useState('');
    const [allData, setAllData] = useState([]); // Lưu mảng gốc đầy đủ
    const [data, setData] = useState([]);       // Mảng dùng để hiển thị kết quả lọc
    const [textFilter, setTextFilter]=useState('')
     const fakerDataRaw = Array.from({ length: 5 }, () => ({
            id: faker.string.uuid(),
            title: faker.book.title(),
            likes: (faker.number.float({ min: 0.5, max: 5.0, precision: 0.1 })).toFixed(1) + 'M',
            genres: ' Truyện Hay/fanfic',
            coverImage: cardImg,
        }));
    // Dùng useEffect để sinh dữ liệu Faker 1 lần duy nhất khi component mount trên Client
    useEffect(() => {
        const fakerData = Array.from({ length: 50 }, () => ({
            id: faker.string.uuid(),
            title: faker.book.title(),
            likes: (faker.number.float({ min: 0.5, max: 5.0, precision: 0.1 })).toFixed(1) + 'M',
            genres: ' Truyện Hay/fanfic',
            coverImage: cardImg,
        }));
        setAllData(fakerData);
        setData(fakerData);
    }, []);

    const search = () => {
        // Lọc từ mảng gốc 'allData' thay vì lọc từ 'data'
        const dataFilter = allData.filter(novel => 
            novel.title.toLocaleLowerCase().includes(textInput.toLocaleLowerCase())
        );
        setData(dataFilter);
        setTextFilter(textInput)
    };

    return (
        <div>
            <div className='containtSearch'>
                <input 
                    type='text' 
                    placeholder='search story'
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                />
                <button className="btn_search" onClick={search}>
                    <SearchIcon className="text-muted shrink-0" color="white"/>
                </button>
            </div>
            
            <div className="resultSearch">
                {
                    textFilter !== '' ? 
                    <>
                        <h1>Từ khóa tìm kiếm là :{textFilter}</h1> 
                        <div className="gridContaint">
                        {
                            data.map((novel) => (
                                <CardStory 
                                    key={novel.id}
                                    title={novel.title}
                                    like={novel.likes}
                                    genres={novel.genres}
                                    coverImage={novel.coverImage}
                                />
                            ))
                        }
                        </div>
                       
                    </>
                    : 
                    <>
                        <h1>Đề xuất truyện</h1>
                         <div className="gridContaint">
                        {
                            fakerDataRaw.map((novel) => (
                                <CardStory 
                                    key={novel.id}
                                    title={novel.title}
                                    like={novel.likes}
                                    genres={novel.genres}
                                    coverImage={novel.coverImage}
                                />
                            ))
                        }
                        </div>     
                    </>
                    
                }
                
            </div>
        </div>
    );
}