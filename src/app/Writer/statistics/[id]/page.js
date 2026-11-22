import StatisticsDashboard from '@/components/WriterStatistics/StatisticsDashboard'
import { requireUser } from '@/server/auth/dal'
import { ApiError } from '@/server/http'
import { getNovelStatistics } from '@/server/services/writer'

export const metadata = { title: 'Thống kê truyện | Novely' }

export default async function NovelStatisticsPage({ params }) {
    const { id } = await params
    const user = await requireUser(`/Writer/statistics/${id}`)
    let statistics = null
    try {
        statistics = await getNovelStatistics(user, id)
    } catch (error) {
        // Truyện không tồn tại hoặc không phải của mình: hiển thị "không tìm thấy".
        if (!(error instanceof ApiError && (error.status === 404 || error.status === 403))) throw error
    }
    return <StatisticsDashboard statistics={statistics} />
}
