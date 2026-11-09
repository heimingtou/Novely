'use client'

import './Tabs.css'
import { useI18n } from '@/components/i18n/LocaleProvider'
import { handleTabKey } from '@/lib/tab-navigation'

const tabs = [
    { id: 'published', label: 'Đã đăng tải' },
    { id: 'all', label: 'Tất cả truyện' },
    { id: 'series', label: 'Series' },
]

export default function Tabs({ activeTab, onTabChange }) {
    const { t } = useI18n()
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTab)

    return (
        <nav className="writer-tabs" role="tablist" aria-label={t("Danh sách truyện")} onKeyDown={handleTabKey}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className="writer-tabs__tab"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    aria-controls="writer-story-list"
                    onClick={() => onTabChange(tab.id)}
                >
                    {t(tab.label)}
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
