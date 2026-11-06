import { novelStatistics } from '@/data/novelStatistics'
import StatisticsDashboard from '@/components/WriterStatistics/StatisticsDashboard'

export default async function NovelStatisticsPage({ params }) {
    const { id } = await params
    return <StatisticsDashboard statistics={novelStatistics[id] || null} novelId={id} />
}
