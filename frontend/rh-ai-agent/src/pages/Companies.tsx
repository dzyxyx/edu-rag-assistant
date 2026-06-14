import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { 
  Building2, Search, CheckCircle2, 
  TrendingUp, Loader2, MapPin, Globe, ChevronLeft, ChevronRight,
  History, BarChart3
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { Company, ScoreHistory } from '@/api/types'

// 🔥 Скелетон таблицы
const TableSkeleton = () => (
  <tbody className="divide-y divide-border">
    {Array.from({ length: 10 }).map((_, i) => (
      <tr key={i}>
        <td className="px-4 py-3"><div className="h-4 w-4 bg-slate-200 rounded animate-pulse" /></td>
        <td className="px-4 py-3">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
          </div>
        </td>
        <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-200 rounded animate-pulse" /></td>
        <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-200 rounded animate-pulse" /></td>
        <td className="px-4 py-3"><div className="h-6 w-12 bg-slate-200 rounded mx-auto animate-pulse" /></td>
        <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded animate-pulse" /></td>
        <td className="px-4 py-3"><div className="h-8 w-20 bg-slate-200 rounded animate-pulse" /></td>
      </tr>
    ))}
  </tbody>
)

export default function Companies() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const { addToast } = useAppStore()
  const queryClient = useQueryClient()
  
  // 🔥 Refs для предотвращения дублирования запросов
  const isVerifyingRef = useRef(false)
  const isScoringRef = useRef(false)
  
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    limit: 30,
    offset: 0,
  })
  
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([])
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [selectedCompanyForHistory, setSelectedCompanyForHistory] = useState<Company | null>(null)
  
  // Загрузка компаний
  const { 
    data: companiesData, 
    isLoading, 
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['companies', filters],
    queryFn: () => companiesApi.list(filters).then(res => res.data),
    placeholderData: (previous) => previous || { items: [], total: 0 },
    staleTime: 2 * 60 * 1000,
  })

  // Загрузка истории скоринга
  const { data: scoreHistory } = useQuery({
    queryKey: ['companies', selectedCompanyForHistory?.id, 'score-history'],
    queryFn: () => selectedCompanyForHistory 
      ? companiesApi.getScoreHistory(selectedCompanyForHistory.id, { limit: 50, offset: 0 }).then(res => res.data)
      : Promise.resolve({ items: [], total: 0 }),
    enabled: !!selectedCompanyForHistory && isHistoryModalOpen,
    staleTime: 1 * 60 * 1000,
  })

  const companies = companiesData?.items || []
  const total = companiesData?.total || 0

  // Debounce поиска
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput, offset: 0 }))
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const currentPage = Math.floor(filters.offset / filters.limit) + 1
  const totalPages = total > 0 ? Math.ceil(total / filters.limit) : (companies.length > 0 ? currentPage : 1)

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status: status === prev.status ? '' : status, offset: 0 }))
  }

  const toggleCompany = (id: number) => {
    setSelectedCompanies(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    if (selectedCompanies.length === companies.length && companies.length > 0) {
      setSelectedCompanies([])
    } else {
      setSelectedCompanies(companies.map(c => c.id))
    }
  }

  // 🔥 Мутация верификации с защитой от дублирования
  const verifyMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      // 🔥 Предотвращаем дублирование
      if (isVerifyingRef.current) {
        console.log('⚠️ Verification already in progress, skipping duplicate request')
        throw new Error('Already verifying')
      }
      
      isVerifyingRef.current = true
      console.log('📤 Verifying companies:', ids)
      
      try {
        const results = await Promise.all(
          ids.map(id => 
            companiesApi.updateStatus(id, { status: 'verified' })
          )
        )
        console.log('✅ Companies verified:', results.length)
        return results
      } finally {
        isVerifyingRef.current = false
      }
    },
    onSuccess: async () => {
      console.log('✅ Verification completed')
      await queryClient.invalidateQueries({ queryKey: ['companies', filters] })
      await refetch()
      addToast('Компании успешно верифицированы', 'success')
    },
    onError: (error: any) => {
      // Игнорируем ошибки от дублирования
      if (error.message === 'Already verifying') return
      
      console.error('❌ Verify error:', error)
      const message = error.response?.data?.detail || error.message || 'Не удалось верифицировать'
      addToast(message, 'error')
    },
    onSettled: () => {
      isVerifyingRef.current = false
    },
  })

  // 🔥 Мутация скоринга с защитой от дублирования
  const scoreMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      // 🔥 Предотвращаем дублирование
      if (isScoringRef.current) {
        console.log('⚠️ Scoring already in progress, skipping duplicate request')
        throw new Error('Already scoring')
      }
      
      isScoringRef.current = true
      console.log('📤 Rescoring companies:', ids)
      
      try {
        const results = await Promise.all(
          ids.map(id => 
            companiesApi.rescoreCompany(id)
          )
        )
        console.log('✅ Scoring completed for', results.length, 'companies')
        return results
      } finally {
        isScoringRef.current = false
      }
    },
    onSuccess: async (results) => {
      console.log('✅ Scoring results:', results)
      // Показываем результаты
      const updated = results.filter(r => r.data?.status === 'shortlisted').length
      await queryClient.invalidateQueries({ queryKey: ['companies', filters] })
      await refetch()
      if (updated > 0) {
        addToast(`Скоринг завершён. ${updated} компаний в шорт-листе`, 'success')
      } else {
        addToast('Скоринг завершён', 'success')
      }
    },
    onError: (error: any) => {
      // Игнорируем ошибки от дублирования
      if (error.message === 'Already scoring') return
      
      console.error('❌ Score error:', error)
      const message = error.response?.data?.detail || error.message || 'Не удалось пересчитать скоринг'
      addToast(message, 'error')
    },
    onSettled: () => {
      isScoringRef.current = false
    },
  })

  // 🔥 Мутация скоринга для одной компании с защитой
  const singleScoreMutation = useMutation({
    mutationFn: async (companyId: number) => {
      if (isScoringRef.current) {
        console.log('⚠️ Single scoring already in progress')
        throw new Error('Already scoring')
      }
      
      isScoringRef.current = true
      console.log('📤 Rescoring single company:', companyId)
      
      try {
        const response = await companiesApi.rescoreCompany(companyId)
        console.log('✅ Single company rescored:', response.data)
        return response
      } finally {
        isScoringRef.current = false
      }
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['companies', filters] })
      await refetch()
      const newStatus = response.data?.status
      const score = Math.round((response.data?.score || 0) * 100)
      
      if (newStatus === 'shortlisted') {
        addToast(`Скоринг: ${score}/100 → В шорт-листе!`, 'success')
      } else {
        addToast(`Скоринг: ${score}/100`, 'success')
      }
    },
    onError: (error: any) => {
      if (error.message === 'Already scoring') return
      
      console.error('❌ Single score error:', error)
      addToast(error.message || 'Ошибка скоринга', 'error')
    },
    onSettled: () => {
      isScoringRef.current = false
    },
  })

  const handleVerify = () => {
    if (selectedCompanies.length > 0 && !isVerifyingRef.current) {
      verifyMutation.mutate(selectedCompanies)
      setIsVerifyModalOpen(false)
      setSelectedCompanies([])
    }
  }

  const handleScore = () => {
    if (selectedCompanies.length > 0 && !isScoringRef.current) {
      scoreMutation.mutate(selectedCompanies)
      setSelectedCompanies([])
    }
  }

  const openHistoryModal = (company: Company) => {
    setSelectedCompanyForHistory(company)
    setIsHistoryModalOpen(true)
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'success' | 'warning' | 'info'; label: string }> = {
      'new': { variant: 'info', label: locale === 'ru' ? 'Новая' : 'New' },
      'verified': { variant: 'success', label: locale === 'ru' ? 'Верифицирована' : 'Verified' },
      'in_progress': { variant: 'warning', label: locale === 'ru' ? 'В работе' : 'In Progress' },
      'rejected': { variant: 'default', label: locale === 'ru' ? 'Отклонена' : 'Rejected' },
      'shortlisted': { variant: 'success', label: locale === 'ru' ? 'В шорт-листе' : 'Shortlisted' },
      'scored': { variant: 'default', label: locale === 'ru' ? 'Оценена' : 'Scored' },
    }
    const { variant, label } = config[status] || { variant: 'default' as const, label: status }
    return <Badge variant={variant}>{label}</Badge>
  }

  const getTriggerBadge = (trigger: string) => {
    return trigger === 'manual' 
      ? <Badge variant="info" className="text-xs">Ручной</Badge>
      : <Badge variant="secondary" className="text-xs">Автоматический</Badge>
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const showSkeleton = isFetching

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('companies.title')}</h1>
          <p className="text-text-secondary mt-1">{t('companies.subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('companies.search')}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['new', 'verified', 'in_progress', 'shortlisted'].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filters.status === status
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-text-secondary hover:bg-slate-200'
                }`}
              >
                {status === 'new' ? (locale === 'ru' ? 'Новые' : 'New') :
                 status === 'verified' ? (locale === 'ru' ? 'Верифицированные' : 'Verified') :
                 status === 'shortlisted' ? (locale === 'ru' ? 'В шорт-листе' : 'Shortlisted') :
                 (locale === 'ru' ? 'В работе' : 'In Progress')}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Selected Actions */}
      {selectedCompanies.length > 0 && (
        <Card className="p-3 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800 font-medium">
              {locale === 'ru' ? `Выбрано: ${selectedCompanies.length}` : `Selected: ${selectedCompanies.length}`}
            </span>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => setIsVerifyModalOpen(true)} 
                disabled={verifyMutation.isPending || isVerifyingRef.current}
              >
                {verifyMutation.isPending || isVerifyingRef.current ? (
                  <Loader2 size={16} className="mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 size={16} className="mr-1" />
                )}
                {locale === 'ru' ? 'Верифицировать' : 'Verify'}
              </Button>
              <Button 
                size="sm" 
                onClick={handleScore} 
                disabled={scoreMutation.isPending || isScoringRef.current}
              >
                {scoreMutation.isPending || isScoringRef.current ? (
                  <Loader2 size={16} className="mr-1 animate-spin" />
                ) : (
                  <TrendingUp size={16} className="mr-1" />
                )}
                {locale === 'ru' ? 'Скоринг' : 'Score'}
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setSelectedCompanies([])}
                disabled={verifyMutation.isPending || scoreMutation.isPending}
              >
                {locale === 'ru' ? 'Отмена' : 'Cancel'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Companies Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input 
                    type="checkbox" 
                    checked={companies.length > 0 && selectedCompanies.length === companies.length} 
                    onChange={selectAll} 
                    className="rounded border-border" 
                    disabled={showSkeleton}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">{t('companies.table.company')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">{t('companies.table.industry')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">{t('companies.table.region')}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary uppercase">{t('companies.table.scoring')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">{t('companies.table.status')}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary uppercase">Действия</th>
              </tr>
            </thead>
            
            {showSkeleton ? (
              <TableSkeleton />
            ) : companies.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Building2 size={48} className="mx-auto mb-4 text-text-secondary opacity-30" />
                    <h3 className="text-lg font-semibold text-text-primary mb-2">
                      {locale === 'ru' ? 'Компании не найдены' : 'No companies found'}
                    </h3>
                    <p className="text-text-secondary max-w-md mx-auto">
                      {locale === 'ru' ? 'Измените параметры поиска или вернитесь позже.' : 'Try adjusting your search or check back later.'}
                    </p>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-border">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        checked={selectedCompanies.includes(company.id)} 
                        onChange={() => toggleCompany(company.id)} 
                        className="rounded border-border" 
                        disabled={verifyMutation.isPending || scoreMutation.isPending}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{company.name}</div>
                      {company.website && (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                          <Globe size={12} />
                          {company.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{company.industry || '-'}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      <div className="flex items-center gap-1"><MapPin size={14} />{company.region || '-'}</div>
                    </td>
                    
                    {/* Скоринг */}
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-sm font-medium">
                        <TrendingUp size={14} className="text-primary" />
                        {Math.round((company.score ?? 0) * 100)}/100
                      </div>
                    </td>
                    
                    <td className="px-4 py-3">{getStatusBadge(company.status)}</td>
                    
                    {/* Кнопки действий */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2"
                          onClick={() => openHistoryModal(company)}
                          title={locale === 'ru' ? 'История скоринга' : 'Score History'}
                          disabled={isHistoryModalOpen && selectedCompanyForHistory?.id === company.id}
                        >
                          <History size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2"
                          onClick={() => singleScoreMutation.mutate(company.id)}
                          disabled={singleScoreMutation.isPending || isScoringRef.current}
                          title={locale === 'ru' ? 'Пересчитать скоринг' : 'Recalculate Score'}
                        >
                          {singleScoreMutation.isPending || isScoringRef.current ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <TrendingUp size={14} />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50">
            <span className="text-sm text-text-secondary">
              {locale === 'ru' 
                ? `Страница ${currentPage} из ${totalPages} (всего ${total || companies.length})`
                : `Page ${currentPage} of ${totalPages} (${total || companies.length} total)`}
            </span>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="secondary"
                disabled={currentPage === 1 || isFetching}
                onClick={() => setFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
              >
                <ChevronLeft size={16} className="mr-1" />
                {locale === 'ru' ? 'Назад' : 'Previous'}
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                disabled={currentPage >= totalPages || isFetching}
                onClick={() => setFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
              >
                {locale === 'ru' ? 'Вперёд' : 'Next'}
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Verify Modal */}
      <Modal
        isOpen={isVerifyModalOpen}
        onClose={() => !verifyMutation.isPending && setIsVerifyModalOpen(false)}
        title={locale === 'ru' ? 'Верификация компаний' : 'Verify Companies'}
        footer={
          <>
            <Button 
              variant="secondary" 
              onClick={() => setIsVerifyModalOpen(false)}
              disabled={verifyMutation.isPending}
            >
              {locale === 'ru' ? 'Отмена' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleVerify} 
              disabled={verifyMutation.isPending || isVerifyingRef.current}
            >
              {(verifyMutation.isPending || isVerifyingRef.current) && (
                <Loader2 size={16} className="mr-2 animate-spin" />
              )}
              {locale === 'ru' ? 'Верифицировать' : 'Verify'}
            </Button>
          </>
        }
      >
        <p className="text-text-secondary">
          {locale === 'ru' 
            ? `Вы собираетесь верифицировать ${selectedCompanies.length} компаний. Статус будет изменён на "Верифицирована".`
            : `You are about to verify ${selectedCompanies.length} companies. Status will be changed to "Verified".`}
        </p>
      </Modal>

      {/* Score History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-primary" />
            {locale === 'ru' ? 'История скоринга' : 'Score History'}
            {selectedCompanyForHistory && (
              <span className="text-sm text-text-secondary">— {selectedCompanyForHistory.name}</span>
            )}
          </div>
        }
        size="xl"
        footer={
          <Button variant="secondary" onClick={() => setIsHistoryModalOpen(false)}>
            {locale === 'ru' ? 'Закрыть' : 'Close'}
          </Button>
        }
      >
        {selectedCompanyForHistory && (
          <div className="space-y-6">
            {/* График динамики */}
            {scoreHistory && scoreHistory.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-3">
                  {locale === 'ru' ? 'Динамика общего скоринга' : 'Score Dynamics'}
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreHistory.items.map(item => ({
                      date: formatDate(item.created_at),
                      score: Math.round(item.score * 100),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        domain={[0, 100]}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '8px', 
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                        formatter={(value: any) => [`${value}/100`, 'Score']}
                      />
                      <Bar 
                        dataKey="score" 
                        fill="#0ea5e9" 
                        radius={[4, 4, 0, 0]}
                        barSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Детальная разбивка последнего скоринга */}
            {scoreHistory && scoreHistory.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-3">
                  {locale === 'ru' ? 'Последняя оценка' : 'Latest Score'}
                  <span className="text-sm text-text-secondary ml-2">
                    ({formatDate(scoreHistory.items[0].created_at)})
                  </span>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'Общий score', value: scoreHistory.items[0].score },
                    { key: 'Tech Stack', value: scoreHistory.items[0].score_tech_stack },
                    { key: 'Scale', value: scoreHistory.items[0].score_scale },
                    { key: 'Reputation', value: scoreHistory.items[0].score_reputation },
                    { key: 'Edu Experience', value: scoreHistory.items[0].score_edu_experience },
                    { key: 'Vacancy Activity', value: scoreHistory.items[0].score_vacancy_activity },
                    { key: 'Priority Bonus', value: scoreHistory.items[0].priority_bonus },
                  ].map(({ key, value }) => (
                    <Card key={key} className="p-3">
                      <p className="text-xs text-text-secondary mb-1">{key}</p>
                      <p className="text-lg font-bold text-text-primary">
                        {typeof value === 'number' ? Math.round(value * 100) : 'N/A'}
                        {key !== 'Priority Bonus' && <span className="text-sm text-text-secondary">/100</span>}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* История */}
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-3">
                {locale === 'ru' ? 'Все расчёты' : 'All Calculations'}
              </h4>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {scoreHistory?.items.map((item: ScoreHistory, index: number) => (
                  <Card key={item.id || index} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          {Math.round(item.score * 100)}/100
                        </span>
                        {getTriggerBadge(item.trigger)}
                      </div>
                      <span className="text-xs text-text-secondary">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-text-secondary">
                        Tech: {Math.round((item.score_tech_stack || 0) * 100)}
                      </div>
                      <div className="text-text-secondary">
                        Scale: {Math.round((item.score_scale || 0) * 100)}
                      </div>
                      <div className="text-text-secondary">
                        Rep: {Math.round((item.score_reputation || 0) * 100)}
                      </div>
                    </div>
                  </Card>
                ))}
                {(!scoreHistory || scoreHistory.items.length === 0) && (
                  <div className="text-center py-8 text-text-secondary">
                    <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{locale === 'ru' ? 'История скоринга пуста' : 'No score history'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}