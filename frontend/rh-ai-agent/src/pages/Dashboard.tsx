import { useDashboard } from '@/hooks/useDashboard'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { TrendingUp, Users, Mail, Calendar, FolderOpen, Activity, Download, ArrowRight, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'
import { exportCompaniesReport } from '@/lib/export'

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  
  // Используем хук для получения статистики из API
  const { stats, isLoading } = useDashboard()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin mr-2" /> {t('common.loading')}
      </div>
    )
  }

  // Формируем данные для графика на основе ответа API или используем моковые, если API еще не готов
  const chartData = stats?.conversion_chart || [
    { month: locale === 'ru' ? 'Июнь' : 'Jun', value: 2 },
    { month: locale === 'ru' ? 'Июль' : 'Jul', value: 5 },
    { month: locale === 'ru' ? 'Авг' : 'Aug', value: 8 },
    { month: locale === 'ru' ? 'Сен' : 'Sep', value: 10 },
    { month: locale === 'ru' ? 'Окт' : 'Oct', value: 12 },
    { month: locale === 'ru' ? 'Ноя' : 'Nov', value: 15 }
  ]

  const kpiData = [
    { label: t('dashboard.kpi.companies'), value: stats?.total_companies || 0, change: '+12%', icon: Users },
    { label: t('dashboard.kpi.conversion'), value: `${stats?.conversion_rate || 0}%`, change: '+2.1%', icon: Mail },
    { label: t('dashboard.kpi.meetings'), value: stats?.meetings_count || 0, change: locale === 'ru' ? 'За неделю' : 'This week', icon: Calendar },
    { label: t('dashboard.kpi.projects'), value: stats?.total_projects || 0, change: '+5', icon: FolderOpen }
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('dashboard.title')}</h1>
          <p className="text-text-secondary mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCompaniesReport}>
          <Download size={16} className="mr-2" />
          {t('dashboard.export')}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.label} className="flex flex-col justify-between hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start">
              <span className="text-sm text-text-secondary">{kpi.label}</span>
              <kpi.icon size={18} className="text-primary" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-text-primary">{kpi.value}</span>
              <span className="ml-2 text-xs text-status-success flex items-center gap-1">
                <TrendingUp size={12} /> {kpi.change}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h3 className="font-semibold text-text-primary mb-4">{t('dashboard.charts.conversionTitle')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }} />
                <Bar dataKey="value" fill="#155DFC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-text-primary mb-3">{t('dashboard.activity.title')}</h3>
          <div className="space-y-3 text-sm">
            {!stats?.recent_activities || stats.recent_activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Mail size={24} className="text-text-secondary mb-2 opacity-30" />
                <p className="text-text-secondary opacity-60">{t('dashboard.activity.empty')}</p>
                <p className="text-xs text-text-secondary">{t('dashboard.activity.emptySub')}</p>
              </div>
            ) : (
              stats.recent_activities.slice(0, 4).map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-transparent hover:border-border transition-colors">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-text-primary font-medium truncate">{activity.action}</p>
                    <p className="text-xs text-text-secondary truncate">{activity.details}</p>
                  </div>
                  <span className="ml-auto text-xs text-text-secondary shrink-0">{new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={20} className="text-primary" />
          <h3 className="font-semibold text-text-primary">{t('dashboard.logs.title')}</h3>
          {stats?.recent_activities && <Badge variant="info">{stats.recent_activities.length}</Badge>}
        </div>
        
        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
          {!stats?.recent_activities || stats.recent_activities.length === 0 ? (
            <div className="text-center py-8 text-text-secondary opacity-60">
              <p>{t('dashboard.logs.empty')}</p>
            </div>
          ) : (
            stats.recent_activities.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-sm pb-3 border-b border-border last:border-0 animate-in fade-in slide-in-from-top-2">
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                  log.type === 'success' ? 'bg-green-500' : log.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="font-medium text-text-primary">{log.action}</p>
                  <p className="text-xs text-text-secondary">{log.details}</p>
                </div>
                <span className="ml-auto text-xs text-gray-400 shrink-0 font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}