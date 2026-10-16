"use client";
import { SearchIcon } from "lucide-react";
import './page.css';
import { useState, useEffect } from "react";
import { faker } from "@faker-js/faker";
import CardStory from "@/components/cardStory/cardStory";
import cardImg from '../../../public/CardStory.jpg'
import ListStory from "@/components/ListStory/ListStory";
 const fakerDataRaw = Array.from({ length: 5 }, () => ({
            id: faker.string.uuid(),
            title: faker.book.title(),
            likes: (faker.number.float({ min: 0.5, max: 5.0, precision: 0.1 })).toFixed(1) + 'M',
            genres: ' Truyện Hay/fanfic',
            coverImage: cardImg,
        }));
export default function SearchPage() {
    const [textInput, setTextInput] = useState('');
    const [allData, setAllData] = useState([]); // Lưu mảng gốc đầy đủ
    const [data, setData] = useState([]);       // Mảng dùng để hiển thị kết quả lọc
    const [textFilter, setTextFilter]=useState('')
    const [dataRaw, setRaw]=useState(fakerDataRaw)
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
        if(textInput==''){
            setTextFilter('')
            return}
        const dataFilter = allData.filter(novel => 
            novel.title.toLocaleLowerCase().includes(textInput.toLocaleLowerCase())
        );
        setTextInput('')
        setData(dataFilter);
        const filter= `kết quả tìm kiếm của từ khóa: ${textInput}`
        setTextFilter(filter)
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
                        <ListStory title={textFilter} DataStory={data}/>
                    </>
                    : 
                    <>
                        
                        <ListStory title={"Đề xuất truyện"} DataStory={dataRaw} />
                    </>
                    
                }
                
            </div>
        </div>
    );
}