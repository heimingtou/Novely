import { notFound } from 'next/navigation'
import { novelStatistics } from '@/data/novelStatistics'
import StatisticsDashboard from '@/components/WriterStatistics/StatisticsDashboard'

export default async function NovelStatisticsPage({ params }) {
    const { id } = await params
    const statistics = Object.hasOwn(novelStatistics, id) ? novelStatistics[id] : null

    if (!statistics) {
        notFound()
    }

    return <StatisticsDashboard statistics={statistics} />
}
