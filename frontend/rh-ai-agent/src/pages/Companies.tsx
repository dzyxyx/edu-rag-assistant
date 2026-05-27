import { useState } from 'react'
import { useCompanies } from '@/hooks/useCompanies'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { 
  Building2, Search, Filter, Download, CheckCircle2, 
  TrendingUp, Loader2, MapPin, Globe, Users 
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { exportCompaniesReport } from '@/lib/export'

export default function Companies() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    limit: 50,
    offset: 0,
  })
  
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([])
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  
  const { 
    companies, 
    total, 
    isLoading, 
    verifyCompanies, 
    isVerifying,
    scoreCompanies,
    isScoring,
    refetch 
  } = useCompanies(filters)

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value, offset: 0 }))
  }

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status: status === prev.status ? '' : status, offset: 0 }))
  }

  const toggleCompany = (id: number) => {
    setSelectedCompanies(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    if (selectedCompanies.length === companies.length) {
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
    const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'info'; label: string }> = {
      'new': { variant: 'info', label: locale === 'ru' ? 'Новая' : 'New' },
      'verified': { variant: 'success', label: locale === 'ru' ? 'Верифицирована' : 'Verified' },
      'in_progress': { variant: 'warning', label: locale === 'ru' ? 'В работе' : 'In Progress' },
      'rejected': { variant: 'default', label: locale === 'ru' ? 'Отклонена' : 'Rejected' },
    }
    const config = statusConfig[status] || { variant: 'default' as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('companies.title')}</h1>
          <p className="text-text-secondary mt-1">{t('companies.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportCompaniesReport()}>
            <Download size={16} className="mr-2" />
            {t('companies.export')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={filters.search}
              onChange={handleSearch}
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
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => setIsVerifyModalOpen(true)}
                disabled={isVerifying}
              >
                <CheckCircle2 size={16} className="mr-1" />
                {locale === 'ru' ? 'Верифицировать' : 'Verify'}
              </Button>
              <Button 
                size="sm"
                onClick={handleScore}
                disabled={isScoring}
              >
                <TrendingUp size={16} className="mr-1" />
                {locale === 'ru' ? 'Скоринг' : 'Score'}
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setSelectedCompanies([])}
              >
                {locale === 'ru' ? 'Отмена' : 'Cancel'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Companies List */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8">
            <Building2 size={48} className="text-text-secondary mb-4 opacity-30" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              {locale === 'ru' ? 'Компании не найдены' : 'No companies found'}
            </h3>
            <p className="text-text-secondary max-w-md">
              {locale === 'ru' 
                ? 'Начните с верификации компаний на вкладке "Анализ индустрии"'
                : 'Start by verifying companies in the "Industry Analysis" tab'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCompanies.length === companies.length && companies.length > 0}
                      onChange={selectAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                    {t('companies.table.company')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                    {t('companies.table.industry')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                    {t('companies.table.region')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary uppercase">
                    {t('companies.table.scoring')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                    {t('companies.table.status')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companies.map((company) => (
                  <tr 
                    key={company.id} 
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCompanies.includes(company.id)}
                        onChange={() => toggleCompany(company.id)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-text-primary">{company.name}</div>
                        {company.website && (
                          <a 
                            href={company.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                          >
                            <Globe size={12} />
                            {company.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {company.industry || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      <div className="flex items-center gap-1">
                        <MapPin size={14} />
                        {company.region || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-sm font-medium">
                        <TrendingUp size={14} className="text-primary" />
                        {company.score?.toFixed(0) || 0}/100
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(company.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination Info */}
      {companies.length > 0 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>
            {locale === 'ru' 
              ? `Показано ${companies.length} из ${total}`
              : `Showing ${companies.length} of ${total}`}
          </span>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="secondary"
              disabled={filters.offset === 0}
              onClick={() => setFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
            >
              {locale === 'ru' ? 'Назад' : 'Previous'}
            </Button>
            <Button 
              size="sm" 
              variant="secondary"
              disabled={companies.length < filters.limit}
              onClick={() => setFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
            >
              {locale === 'ru' ? 'Вперёд' : 'Next'}
            </Button>
          </div>
        </div>
      )}

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