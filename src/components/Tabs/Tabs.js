'use client'

import './Tabs.css'

const tabs = [
    { id: 'published', label: 'Đã đăng tải' },
    { id: 'all', label: 'Tất cả truyện' },
    { id: 'series', label: 'Series' },
]

export default function Tabs({ activeTab, onTabChange }) {
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTab)

    return (
        <nav className="writer-tabs" role="tablist" aria-label="Danh sách truyện">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className="writer-tabs__tab"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => onTabChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
            <span
                aria-hidden="true"
                className="writer-tabs__indicator"
                style={{
                    width: `${100 / tabs.length}%`,
                    transform: `translateX(${activeIndex * 100}%)`,
                }}
            />
        </nav>
    )
}
