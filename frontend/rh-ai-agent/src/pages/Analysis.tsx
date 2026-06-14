import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { industryApi, competenciesApi, tasksApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, BrainCircuit, CheckCircle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'

export default function Analysis() {
  const { i18n } = useTranslation()
  const { addToast } = useAppStore()
  const queryClient = useQueryClient()
  
  // 🔥 Загрузка данных с placeholderData для мгновенного рендера
  const { data: competenciesData, isLoading: isLoadingCompetencies } = useQuery({
    queryKey: ['industry', 'competencies', { limit: 500 }],
    queryFn: () => industryApi.getCompetencies({ limit: 500 }).then(res => res.data),
    placeholderData: (previous) => previous || { items: [], total: 0 },
    staleTime: 5 * 60 * 1000,
  })

  const { data: matrixData } = useQuery({
    queryKey: ['industry', 'matrix'],
    queryFn: () => industryApi.getMatrix().then(res => res.data),
    placeholderData: (previous) => previous || { items: [], total: 0 },
    staleTime: 5 * 60 * 1000,
  })

  // 🔥 Безопасное извлечение данных
  const competencies = competenciesData?.items || []
  const matrixItems = matrixData?.items || []

  // 🔥 Подготовка данных для Radar Chart (Профиль компетенций)
  const radarData = useMemo(() => {
    // Разделяем компетенции по источникам (пока только industry)
    const industryComps = competencies.filter(c => c?.source === 'industry')
    const programComps = competencies.filter(c => c?.source === 'program')
  
    // Берём топ-6 по востребованности на рынке
    const topIndustry = industryComps
      .sort((a, b) => (b.demand_score || 0) - (a.demand_score || 0))
      .slice(0, 6)
  
    return topIndustry.map(indComp => {
      // Ищем соответствующую компетенцию из программы (пока не реализовано)
      const progComp = programComps.find(pc => 
        pc?.name?.toLowerCase() === indComp?.name?.toLowerCase() &&
        pc?.category === indComp?.category
      )
    
      return {
        subject: indComp?.name || 'Без названия',
        'Рынок': Math.round((indComp?.demand_score || 0) * 100),
        'Программа': progComp ? Math.round((progComp.demand_score || 0) * 100) : 0,
        fullMark: 100,
      }
    })
  }, [competencies])

  // 🔥 Подготовка данных для Gap Analysis
  const gapData = useMemo(() => {
    const industryComps = competencies.filter(c => c?.source === 'industry')
    const programComps = competencies.filter(c => c?.source === 'program')
  
    const topIndustry = industryComps
      .sort((a, b) => (b.demand_score || 0) - (a.demand_score || 0))
      .slice(0, 6)
  
    return topIndustry.map(indComp => {
      const progComp = programComps.find(pc => 
        pc?.name?.toLowerCase() === indComp?.name?.toLowerCase() &&
        pc?.category === indComp?.category
      )
    
      const marketDemand = Math.round((indComp?.demand_score || 0) * 100)
      const programCoverage = progComp ? Math.round((progComp.demand_score || 0) * 100) : 0
    
      return {
        name: indComp?.name || 'Без названия',
        'Рынок': marketDemand,
        'Программа': programCoverage,
        gap: marketDemand - programCoverage,
      }
    })
  }, [competencies])

  // 🔥 Данные для таблицы (детализация по навыкам)
  const tableData = useMemo(() => {
    const industryComps = competencies.filter(c => c?.source === 'industry')
    const programComps = competencies.filter(c => c?.source === 'program')
  
    return industryComps
      .sort((a, b) => (b.demand_score || 0) - (a.demand_score || 0))
      .slice(0, 6)
      .map(indComp => {
        const progComp = programComps.find(pc => 
          pc?.name?.toLowerCase() === indComp?.name?.toLowerCase() &&
          pc?.category === indComp?.category
        )
      
        const marketDemand = Math.round((indComp?.demand_score || 0) * 100)
        const programCoverage = progComp ? Math.round((progComp.demand_score || 0) * 100) : 0
      
        // Определяем тренд на основе frequency
        let trend: 'growing' | 'stable' | 'declining' = 'stable'
        if ((indComp?.frequency || 0) > 50) trend = 'growing'
        else if ((indComp?.frequency || 0) < 20) trend = 'declining'
      
        return {
          skill: indComp?.name || 'Без названия',
          category: indComp?.category || '',
          demand: marketDemand,
          program: programCoverage,
          gap: marketDemand - programCoverage,
          trend,
          frequency: indComp?.frequency || 0,
        }
      })
  }, [competencies])

  // 🔥 Мутация для кнопки "Проверить выводы агента" (реальный вызов к бэкенду)
  const verifyInsightsMutation = useMutation({
    mutationFn: async () => {
      // Реальный вызов к бэкенду - передаём индустрию и пустой массив навыков (пока)
      return competenciesApi.approveStrategy('IT', [])
    },
    onSuccess: () => {
      addToast('Выводы агента проверены', 'success')
      queryClient.invalidateQueries({ queryKey: ['industry'] })
    },
    onError: (error: any) => {
      let message = 'Ошибка при проверке выводов'
      if (error.response?.status === 422) {
        message = 'Неверные данные для проверки'
      } else if (error.response?.status === 503) {
        message = 'Сервис временно недоступен'
      }
      addToast(message, 'error')
    },
  })

  const getTrendBadge = (trend: string) => {
    const config = {
      'growing': { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', label: 'Растёт' },
      'declining': { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', label: 'Падает' },
      'stable': { icon: Minus, color: 'text-slate-600', bg: 'bg-slate-50', label: 'Стабильно' },
    }
    const { icon: Icon, color, bg, label } = config[trend as keyof typeof config] || config.stable
    
    return (
      <Badge variant="secondary" className={`${bg} ${color} border-0 gap-1`}>
        <Icon size={12} />
        {label}
      </Badge>
    )
  }

  // 🔥 Убрали блокирующий рендер при загрузке - страница рендерится мгновенно
  // isLoadingCompetencies можно использовать для показа индикатора в отдельных элементах

  return (
    <div className="space-y-6 px-4 md:px-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Анализ индустрии и компетенций</h1>
          <p className="text-text-secondary mt-1 text-sm">
            Фаза 1. Сравнение учебной программы с требованиями рынка
          </p>
        </div>
        <Button 
          variant="primary" 
          size="sm" 
          className="gap-2"
          onClick={() => verifyInsightsMutation.mutate()}
          disabled={verifyInsightsMutation.isPending}
        >
          {verifyInsightsMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <BrainCircuit size={16} />
          )}
          Проверить выводы агента
        </Button>
      </div>

      {/* Top Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Профиль компетенций (Radar Chart) */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-6">Профиль компетенций</h3>
          <div className="h-[320px] w-full">
            {radarData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-text-secondary text-sm">
                Нет данных для отображения
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]} 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Рынок"
                    dataKey="Рынок"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fill="#0ea5e9"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name="Программа"
                    dataKey="Программа"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="#f59e0b"
                    fillOpacity={0.3}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-slate-600 ml-2">{value}</span>}
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      backgroundColor: 'white'
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Разрыв компетенций (Gap Analysis) */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-6">Разрыв компетенций (Gap Analysis)</h3>
          <div className="h-[320px] w-full">
            {gapData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-text-secondary text-sm">
                Нет данных для отображения
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gapData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      backgroundColor: 'white'
                    }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="rect"
                    formatter={(value) => <span className="text-xs text-slate-600 ml-2">{value}</span>}
                  />
                  <Bar 
                    name="Рынок" 
                    dataKey="Рынок" 
                    fill="#1e293b" 
                    radius={[4, 4, 0, 0]}
                    barSize={32}
                  />
                  <Bar 
                    name="Программа" 
                    dataKey="Программа" 
                    fill="#cbd5e1" 
                    radius={[4, 4, 0, 0]}
                    barSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Детализация по навыкам (Table) */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-6">Детализация по навыкам</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary uppercase">Навык</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary uppercase w-[200px]">Востребованность</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary uppercase w-[200px]">В программе</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary uppercase w-[120px]">Тренд</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-text-secondary">
                    Нет данных для отображения
                  </td>
                </tr>
              ) : (
                tableData.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-text-primary text-sm">{row.skill}</p>
                        <p className="text-xs text-text-secondary mt-0.5">{row.category}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 max-w-[120px]">
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-slate-800 rounded-full transition-all"
                              style={{ width: `${row.demand}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium text-text-primary w-12 text-right">
                          {row.demand}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 max-w-[120px]">
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                row.gap > 20 ? 'bg-blue-500' : 'bg-blue-300'
                              }`}
                              style={{ width: `${row.program}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium text-text-primary w-12 text-right">
                          {row.program}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {getTrendBadge(row.trend)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}