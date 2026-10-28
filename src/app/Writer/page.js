'use client'

import { useState } from 'react'
import CardWriter from "@/components/CardWriter/cardwriter"
import Tabs from "@/components/Tabs/Tabs"
import cardImg from '../../../public/CardStory.jpg'
import './page.css'
import { Plus, PlusCircle } from 'lucide-react'
const NovelDatas={
  "novels": [
    {
      "id": 1,
      "img":cardImg,
      "title": "Hệ Thống Đọc Sách Nhận Thưởng",
      "publish_date": "2026-03-15T10:30:00Z",
      "views": 15420,
      "likes": 1230,
      "comments": 450,
      "current_chapters": 120
    },
    {
      "id": 2,
      "img":cardImg,
      "title": "Ta Cùng Nàng Phiêu Lưu Giữa Thế Giới Ảo",
      "publish_date": "2026-03-15T10:30:00Z",
      "views": 8900,
      "likes": 750,
      "comments": 180,
      "current_chapters": 45
    },
    {
      "id": 3,
      "img":cardImg,
      "title": "Điểm Mù: Cuộc Săn Đêm",
      "publish_date": "2026-03-15T10:30:00Z",
      "views": 25100,
      "likes": 3400,
      "comments": 920,
      "current_chapters": 210
    }
  ]
}
const AllNovelDatas={
  "novels": [
    {
      "id": 1,
      "img":cardImg,
      "title": "Hệ Thống Đọc Sách Nhận Thưởng",
      "publish_date": "2026-03-15T10:30:00Z",
      "views": 15420,
      "likes": 1230,
      "comments": 450,
      "current_chapters": 120
    },
    {
      "id": 2,
      "img":cardImg,
      "title": "Ta Cùng Nàng Phiêu Lưu Giữa Thế Giới Ảo",
      "publish_date": "2026-03-15T10:30:00Z",
      "views": 8900,
      "likes": 750,
      "comments": 180,
      "current_chapters": 45
    },
  ] 
}
const SeriesDatas={
  "novels": [
    {
      "id": 1,
      "img":cardImg,
      "title": "Hệ Thống Đọc Sách Nhận Thưởng",
      "publish_date": "2026-03-15T10:30:00Z",
      "views": 15420,
      "likes": 1230,
      "comments": 450,
      "current_chapters": 120
    },
    {
      "id": 2,
      "img":cardImg,
      "title": "Ta Cùng Nàng Phiêu Lưu Giữa Thế Giới Ảo",
      "publish_date": "2026-03-15T10:30:00Z",
      "views": 8900,
      "likes": 750,
      "comments": 180,
      "current_chapters": 45
    },
    {
      "id": 3,
      "img":cardImg,
      "title": "Điểm Mù: Cuộc Săn Đêm",
      "publish_date": "2026-03-15T10:30:00Z",
      "views": 25100,
      "likes": 3400,
      "comments": 920,
      "current_chapters": 210
    }
  ]
}

const novelDataByTab = {
    published: NovelDatas,
    all: AllNovelDatas,
    series: SeriesDatas,
}

export default function WriterPage(){
    const [activeTab, setActiveTab] = useState('published')
    const selectedNovelData = novelDataByTab[activeTab]

    return(
        <div className="ContaintPage writer-page">
            <div className="titlePage flex flex-row justify-between items-center">
                <h1>Truyện đã viết</h1>
                <button className='btn'> <span><Plus/> </span> <span>Đăng truyện mới</span> </button>
            </div>
            <div className="writer-content">
                <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
                <div className="content flex flex-col gap-3">
                    {
                        selectedNovelData.novels.map((novelData) => (
                            <CardWriter
                                key={novelData.id}
                                id={novelData.id}
                                title={novelData.title}
                                img={novelData.img}
                                date={novelData.publish_date}
                                view={novelData.views}
                                like={novelData.likes}
                                comment={novelData.comments}
                                current_chap={novelData.current_chapters}
                            />
                        ))
                    }
                    
                </div>
            </div>
        </div>
    )
}