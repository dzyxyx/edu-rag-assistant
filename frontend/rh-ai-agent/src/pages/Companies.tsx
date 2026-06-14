import { useState, useEffect } from 'react'
import { useCompanies } from '@/hooks/useCompanies'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { 
  Building2, Search, Download, CheckCircle2, 
  TrendingUp, Loader2, MapPin, Globe, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

//  Скелетон таблицы
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
      </tr>
    ))}
  </tbody>
)

export default function Companies() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    limit: 30,
    offset: 0,
  })
  
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([])
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  
  const { 
    companies, 
    total, 
    isLoading, 
    isFetching,
    verifyCompanies, 
    isVerifying,
    scoreCompanies,
    isScoring,
  } = useCompanies(filters)

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

  const handleVerify = () => {
    if (selectedCompanies.length > 0) {
      verifyCompanies(selectedCompanies)
      setIsVerifyModalOpen(false)
      setSelectedCompanies([])
    }
  }

  const handleScore = () => {
    if (selectedCompanies.length > 0) {
      scoreCompanies(selectedCompanies)
      setSelectedCompanies([])
    }
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'success' | 'warning' | 'info'; label: string }> = {
      'new': { variant: 'info', label: locale === 'ru' ? 'Новая' : 'New' },
      'verified': { variant: 'success', label: locale === 'ru' ? 'Верифицирована' : 'Verified' },
      'in_progress': { variant: 'warning', label: locale === 'ru' ? 'В работе' : 'In Progress' },
      'rejected': { variant: 'default', label: locale === 'ru' ? 'Отклонена' : 'Rejected' },
    }
    const { variant, label } = config[status] || { variant: 'default' as const, label: status }
    return <Badge variant={variant}>{label}</Badge>
  }

  //  Показываем скелетон при загрузке ЛЮБОЙ страницы
  const showSkeleton = isFetching

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('companies.title')}</h1>
          <p className="text-text-secondary mt-1">{t('companies.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => {/* export */}}>
          <Download size={16} className="mr-2" />
          {t('companies.export')}
        </Button>
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
            {['new', 'verified', 'in_progress'].map((status) => (
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
              <Button size="sm" variant="secondary" onClick={() => setIsVerifyModalOpen(true)} disabled={isVerifying}>
                <CheckCircle2 size={16} className="mr-1" />
                {locale === 'ru' ? 'Верифицировать' : 'Verify'}
              </Button>
              <Button size="sm" onClick={handleScore} disabled={isScoring}>
                <TrendingUp size={16} className="mr-1" />
                {locale === 'ru' ? 'Скоринг' : 'Score'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedCompanies([])}>
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
              </tr>
            </thead>
            
            {showSkeleton ? (
              <TableSkeleton />
            ) : companies.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
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
                      <input type="checkbox" checked={selectedCompanies.includes(company.id)} onChange={() => toggleCompany(company.id)} className="rounded border-border" />
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
                    
                    {/*  ИСПРАВЛЕНО: Умножаем score (0–1) на 100 для отображения 0–100 */}
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-sm font-medium">
                        <TrendingUp size={14} className="text-primary" />
                        {Math.round((company.score ?? 0) * 100)}/100
                      </div>
                    </td>
                    
                    <td className="px-4 py-3">{getStatusBadge(company.status)}</td>
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
        onClose={() => setIsVerifyModalOpen(false)}
        title={locale === 'ru' ? 'Верификация компаний' : 'Verify Companies'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsVerifyModalOpen(false)}>
              {locale === 'ru' ? 'Отмена' : 'Cancel'}
            </Button>
            <Button onClick={handleVerify} disabled={isVerifying}>
              {isVerifying && <Loader2 size={16} className="mr-2 animate-spin" />}
              {locale === 'ru' ? 'Верифицировать' : 'Verify'}
            </Button>
          </>
        }
      >
        <p className="text-text-secondary">
          {locale === 'ru' 
            ? `Вы собираетесь верифицировать ${selectedCompanies.length} компаний. Это может занять несколько минут.`
            : `You are about to verify ${selectedCompanies.length} companies. This may take a few minutes.`}
        </p>
      </Modal>
    </div>
  )
}