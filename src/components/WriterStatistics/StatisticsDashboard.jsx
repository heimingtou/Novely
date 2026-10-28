'use client'

import { useState } from 'react'
import Link from 'next/link'
import './statistics.css'
import Image from "next/image";
import { ArrowBigLeftDashIcon, ArrowLeft } from 'lucide-react';
const dashboardTabs = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'engagement', label: 'Mức độ tương tác' },
    { id: 'audience', label: 'Đặc điểm độc giả' },
]

const formatNumber = (value) => new Intl.NumberFormat('vi-VN').format(value)

function LineChart({ title, dates, values }) {
    const chart = { left: 42, right: 490, top: 18, bottom: 166 }
    const maxValue = Math.max(...values, 1)
    const points = values.map((value, index) => {
        const x = chart.left + (index * (chart.right - chart.left)) / (values.length - 1)
        const y = chart.bottom - (value / maxValue) * (chart.bottom - chart.top)
        return { x, y, value }
    })
    const pointString = points.map(({ x, y }) => `${x},${y}`).join(' ')

    return (
        <section className="statistics-chart-card">
            <h2>{title}</h2>
            <div className="statistics-chart-scroll">
                <svg
                    className="statistics-line-chart"
                    viewBox="0 0 510 215"
                    role="img"
                    aria-label={`${title} theo ngày`}
                >
                    {[0, 0.5, 1].map((ratio) => {
                        const y = chart.bottom - ratio * (chart.bottom - chart.top)
                        return (
                            <g key={ratio}>
                                <line x1={chart.left} x2={chart.right} y1={y} y2={y} className="statistics-gridline" />
                                <text x="34" y={y + 4} textAnchor="end" className="statistics-axis-label">
                                    {formatNumber(Math.round(maxValue * ratio))}
                                </text>
                            </g>
                        )
                    })}
                    <polyline points={pointString} className="statistics-line" />
                    {points.map(({ x, y, value }, index) => (
                        <circle key={dates[index]} cx={x} cy={y} r="4" className="statistics-point">
                            <title>{`${dates[index]}: ${formatNumber(value)}`}</title>
                        </circle>
                    ))}
                    {dates.map((date, index) => (
                        <text
                            key={date}
                            x={points[index].x}
                            y="194"
                            textAnchor="middle"
                            className="statistics-axis-label"
                        >
                            {date}
                        </text>
                    ))}
                </svg>
            </div>
        </section>
    )
}

function BarChart({ title, chapters, values }) {
    const maxValue = Math.max(...values, 1)
    const barWidth = 42
    const gap = 22
    const chartWidth = chapters.length * (barWidth + gap) + 24

    return (
        <section className="statistics-chart-card">
            <h2>{title}</h2>
            <div className="statistics-chart-scroll">
                <svg
                    className="statistics-bar-chart"
                    viewBox={`0 0 ${chartWidth} 210`}
                    role="img"
                    aria-label={`${title} theo chương`}
                >
                    <line x1="12" x2={chartWidth - 8} y1="166" y2="166" className="statistics-gridline" />
                    {values.map((value, index) => {
                        const x = 18 + index * (barWidth + gap)
                        const height = (value / maxValue) * 140
                        return (
                            <g key={chapters[index]}>
                                <rect
                                    x={x}
                                    y={166 - height}
                                    width={barWidth}
                                    height={height}
                                    rx="5"
                                    className="statistics-bar"
                                >
                                    <title>{`${chapters[index]}: ${formatNumber(value)}`}</title>
                                </rect>
                                <text
                                    x={x + barWidth / 2}
                                    y="190"
                                    textAnchor="middle"
                                    className="statistics-axis-label"
                                >
                                    {chapters[index].replace('Chương ', 'Ch.')}
                                </text>
                            </g>
                        )
                    })}
                </svg>
            </div>
        </section>
    )
}

function PieChart({ title, segments }) {
    const colors = ['#f97316', '#3b82f6', '#a855f7', '#14b8a6']
    const total = segments.reduce((sum, segment) => sum + segment.value, 0)
    const slices = segments.map((segment, index) => {
        const startAngle = segments
            .slice(0, index)
            .reduce((angle, previousSegment) => angle + (previousSegment.value / total) * 360, 0)
        const angle = (segment.value / total) * 360
        const endAngle = startAngle + angle
        const start = {
            x: 100 + 76 * Math.cos((Math.PI * (startAngle - 90)) / 180),
            y: 100 + 76 * Math.sin((Math.PI * (startAngle - 90)) / 180),
        }
        const end = {
            x: 100 + 76 * Math.cos((Math.PI * (endAngle - 90)) / 180),
            y: 100 + 76 * Math.sin((Math.PI * (endAngle - 90)) / 180),
        }
        const largeArc = angle > 180 ? 1 : 0

        return {
            ...segment,
            color: colors[index % colors.length],
            path: `M 100 100 L ${start.x} ${start.y} A 76 76 0 ${largeArc} 1 ${end.x} ${end.y} Z`,
        }
    })

    return (
        <section className="statistics-chart-card statistics-pie-card">
            <h2>{title}</h2>
            <div className="statistics-pie-content">
                <svg viewBox="0 0 200 200" role="img" aria-label={title}>
                    {slices.map((slice) => (
                        <path key={slice.label} d={slice.path} fill={slice.color}>
                            <title>{`${slice.label}: ${slice.value}%`}</title>
                        </path>
                    ))}
                </svg>
                <ul className="statistics-legend">
                    {slices.map((slice) => (
                        <li key={slice.label}>
                            <span style={{ backgroundColor: slice.color }} aria-hidden="true" />
                            <span>{slice.label}</span>
                            <strong>{slice.value}%</strong>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    )
}

export default function StatisticsDashboard({ statistics }) {
    const [activeTab, setActiveTab] = useState(dashboardTabs[0].id)

    return (
        <main className="writer-statistics">
            <Link className="statistics-back-link flex flex-row gap-1" href="/Writer"> <span><ArrowLeft/></span><span> Trở về danh sách truyện</span></Link>
            <header className="statistics-header">
                <div className="imgCart flex flex-row gap-2.5">
                    <div className="imgCart__image">
                        <Image
                            src={statistics.img}
                            className="object-cover rounded"
                            alt={`Bìa truyện ${statistics.title}`}
                            fill
                            sizes="(max-width: 480px) 4rem, 5rem"
                        />
                    </div>
                    <div>
                        <h1>{statistics.title}</h1>
                        <div className="statistics-summary">
                        
                            <div><span>Số độc giả</span><strong>{formatNumber(statistics.readers)}</strong></div>
                            <div><span>Lượt đọc</span><strong>{formatNumber(statistics.views)}</strong></div>
                            <div><span>Số chương</span><strong>{formatNumber(statistics.chapters)}</strong>
                            </div>
                        </div>
                    </div>
                
                </div>
                
            </header>
            <hr/>

            <nav className="statistics-tabs" role="tablist" aria-label="Thống kê truyện">
                {dashboardTabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            {activeTab === 'overview' && (
                <div className="statistics-chart-grid">
                    <LineChart title="Số độc giả theo ngày" dates={statistics.daily.dates} values={statistics.daily.readers} />
                    <LineChart title="Lượt bình chọn theo ngày" dates={statistics.daily.dates} values={statistics.daily.votes} />
                    <LineChart title="Bình luận theo ngày" dates={statistics.daily.dates} values={statistics.daily.comments} />
                </div>
            )}
            {activeTab === 'engagement' && (
                <div className="statistics-chart-grid">
                    <BarChart title="Lượt đọc theo chương" chapters={statistics.chapterEngagement.chapters} values={statistics.chapterEngagement.reads} />
                    <BarChart title="Lượt bình chọn theo chương" chapters={statistics.chapterEngagement.chapters} values={statistics.chapterEngagement.votes} />
                    <BarChart title="Bình luận theo chương" chapters={statistics.chapterEngagement.chapters} values={statistics.chapterEngagement.comments} />
                </div>
            )}
            {activeTab === 'audience' && (
                <div className="statistics-chart-grid statistics-demographics">
                    <PieChart title="Độc giả theo độ tuổi" segments={statistics.demographics.age} />
                    <PieChart title="Độc giả theo giới tính" segments={statistics.demographics.gender} />
                </div>
            )}
        </main>
    )
}
