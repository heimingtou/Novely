'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import CardWriter from "@/components/CardWriter/cardwriter"
import Tabs from "@/components/Tabs/Tabs"

// Danh sách truyện của tác giả đang đăng nhập (dữ liệu từ database, truyền từ app/Writer/page.js).
const filters = {
    published: (novel) => novel.published,
    all: () => true,
    series: () => false, // database chưa có khái niệm series
}
const emptyMessages = {
    published: 'Chưa có truyện nào được xuất bản. Truyện sẽ hiển thị công khai khi có ít nhất một chương đã đăng.',
    all: 'Bạn chưa có truyện nào. Bấm “Đăng truyện mới” để bắt đầu.',
    series: 'Tính năng series chưa được hỗ trợ.',
}

export default function WriterDashboard({ novels }) {
    const [activeTab, setActiveTab] = useState('published')
    const [openChapterListId, setOpenChapterListId] = useState(null)
    const visibleNovels = novels.filter(filters[activeTab])

    return(
        <div className="ContaintPage writer-page">
            <div className="titlePage flex flex-row justify-between items-center">
                <h1>Truyện đã viết</h1>
                <Link className='btn' href="/Writer/new"> <span><Plus/> </span> <span>Đăng truyện mới</span> </Link>
            </div>
            <div className="writer-content">
                <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
                <div className="content flex flex-col gap-3">
                    {visibleNovels.length === 0 && <p className="p-6 text-center text-muted">{emptyMessages[activeTab]}</p>}
                    {visibleNovels.map((novelData) => (
                        <CardWriter
                            key={novelData.id}
                            id={novelData.id}
                            href={novelData.href}
                            title={novelData.title}
                            img={novelData.img}
                            date={novelData.publish_date}
                            view={novelData.views}
                            like={novelData.likes}
                            comment={novelData.comments}
                            current_chap={novelData.current_chapters}
                            published={novelData.published}
                            chapters={novelData.chapters}
                            chaptersOpen={openChapterListId === novelData.id}
                            onToggleChapters={() => setOpenChapterListId((openId) => (
                                openId === novelData.id ? null : novelData.id
                            ))}
                            onCloseChapters={() => setOpenChapterListId(null)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
