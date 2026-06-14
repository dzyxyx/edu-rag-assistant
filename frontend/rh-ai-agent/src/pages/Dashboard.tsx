import { useQuery } from '@tanstack/react-query'
import { dashboardApi, companiesApi, projectsApi, outreachApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { 
  Building2, TrendingUp, Send, Calendar, FolderKanban, 
  AlertTriangle, CheckCircle, Loader2
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'

export default function Dashboard() {
  const { i18n } = useTranslation()

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.stats().then(res => res.data),
    placeholderData: (previous) => previous || {
      companies_total: 0, companies_shortlisted: 0, companies_partners: 0,
      priority_areas_proposed: 0, priority_areas_approved: 0,
      outreach_sent: 0, outreach_replied: 0, outreach_escalated: 0,
      pending_review_total: 0,
    },
    staleTime: 2 * 60 * 1000,
  })

  const { data: pendingReview } = useQuery({
    queryKey: ['dashboard', 'pending-review'],
    queryFn: () => dashboardApi.pendingReview().then(res => res.data),
    placeholderData: (previous) => previous || { total: 0, items: [] },
    staleTime: 1 * 60 * 1000,
  })

  const { data: companies } = useQuery({
    queryKey: ['companies', 'count'],
    queryFn: () => companiesApi.list({ limit: 1, offset: 0 }).then(res => ({ total: res.data.total })),
    placeholderData: { total: 0 },
    staleTime: 5 * 60 * 1000,
  })

  const { data: projects } = useQuery({
    queryKey: ['projects', 'count'],
    queryFn: () => projectsApi.list().then(res => res.data),
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
  })

  const { data: monthlyData, isLoading: isLoadingOutreach } = useQuery({
    queryKey: ['dashboard', 'outreach-monthly'],
    queryFn: async () => {
      const allOutreach = await outreachApi.list().then(res => res.data)
      
      const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
      const now = new Date()
      
      const monthlyMap = new Map<string, { sent: number, replied: number }>()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        monthlyMap.set(key, { sent: 0, replied: 0 })
      }
      
      allOutreach.forEach(item => {
        const date = new Date(item.created_at)
        const key = `${date.getFullYear()}-${date.getMonth()}`
        const monthData = monthlyMap.get(key)
        if (monthData) {
          monthData.sent++
          if (item.status === 'interest' || item.status === 'meeting') {
            monthData.replied++
          }
        }
      })
      
      return Array.from(monthlyMap.entries()).map(([key, data]) => {
        const monthIdx = parseInt(key.split('-')[1])
        const year = key.split('-')[0]
        const currentYear = now.getFullYear()
        
        return {
          month: months[monthIdx] + (year !== currentYear.toString() ? ` ${year}` : ''),
          sent: data.sent,
          conversion: data.sent > 0 ? ((data.replied / data.sent) * 100).toFixed(1) : 0,
        }
      })
    },

    placeholderData: [],
    staleTime: 5 * 60 * 1000,
  })

  const pendingItems = pendingReview?.items || []
  const totalCompanies = companies?.total || stats?.companies_total || 0
  const hasData = monthlyData && monthlyData.length > 0 && monthlyData.some(m => m.sent > 0)

  if (isLoadingStats && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  const s = stats || {
    companies_total: 0, companies_shortlisted: 0, companies_partners: 0,
    priority_areas_proposed: 0, priority_areas_approved: 0,
    outreach_sent: 0, outreach_replied: 0, outreach_escalated: 0,
    pending_review_total: 0,
  }

  const conversionRate = s.outreach_sent > 0 
    ? ((s.outreach_replied / s.outreach_sent) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="space-y-6 px-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Дашборд агента</h1>
        <p className="text-text-secondary mt-1 text-sm">
          Сводная информация о работе ИИ-агента
        </p>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-text-secondary">Найдено компаний</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{totalCompanies}</p>
            </div>
            <Building2 size={18} className="text-text-secondary" />
          </div>
          <div className="flex items-center gap-1 text-xs">
            <TrendingUp size={12} className="text-green-500" />
            <span className="text-green-600 font-medium">+12%</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-text-secondary">Конверсия писем</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{conversionRate}%</p>
            </div>
            <Send size={18} className="text-text-secondary" />
          </div>
          <div className="flex items-center gap-1 text-xs">
            <TrendingUp size={12} className="text-green-500" />
            <span className="text-green-600 font-medium">+2.3%</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-text-secondary">Назначено встреч</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{s.outreach_replied}</p>
            </div>
            <Calendar size={18} className="text-text-secondary" />
          </div>
          <div className="text-xs text-blue-600">За неделю</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-text-secondary">Проектов в каталоге</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{projects?.length || 0}</p>
            </div>
            <FolderKanban size={18} className="text-text-secondary" />
          </div>
          <div className="flex items-center gap-1 text-xs">
            <TrendingUp size={12} className="text-green-500" />
            <span className="text-green-600 font-medium">+5</span>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Конверсия писем по месяцам (%)
          </h3>
          <div className="h-[320px]">
            {/*  Мгновенное отображение "нет данных" */}
            {!hasData ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Calendar size={48} className="text-text-secondary opacity-20 mb-3" />
                <p className="text-text-secondary text-sm font-medium">Нет данных за последние 6 месяцев</p>
                <p className="text-text-secondary text-xs mt-1">
                  Конверсия начнёт отображаться после отправки писем
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                    cursor={{ fill: '#f1f5f9' }}
                    formatter={(value: any) => [`${value}%`, 'Конверсия']}
                  />
                  <Bar 
                    dataKey="conversion" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Right Sidebar */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Требует внимания
          </h3>
          <div className="space-y-2">
            {pendingItems.length === 0 ? (
              <div className="text-center py-4 text-sm text-text-secondary">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-500 opacity-30" />
                <p>Всё в порядке!</p>
              </div>
            ) : (
              pendingItems.slice(0, 5).map((item, index) => (
                <div 
                  key={`${item.type}-${item.id}-${index}`}
                  className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
                  onClick={() => window.location.href = item.link}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-amber-900">{item.title}</p>
                      {item.description && (
                        <p className="text-[10px] text-amber-700 mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}