import { useState } from 'react'
import { useCompanies } from '@/hooks/useCompanies'
import { useAppStore } from '@/store/useAppStore'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Search, Check, ArrowUpDown, Building2, AlertCircle, Download, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { exportCompaniesReport } from '@/lib/export'
import type { CompanyFilters } from '@/api/types'

export default function Companies() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const { addToast } = useAppStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [stackFilter, setStackFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const filters: CompanyFilters = {
    search: search || undefined,
    size: sizeFilter === 'all' ? undefined : sizeFilter,
    region: regionFilter === 'all' ? undefined : regionFilter,
    tech_stack: stackFilter === 'all' ? undefined : stackFilter,
    page: 1,
    limit: 50,
  }

  const { companies, total, isLoading, verifyCompanies, isVerifying } = useCompanies(filters)

  const getStatusVariant = (status: string): 'success' | 'warning' | 'default' => {
    switch (status) {
      case 'active': return 'success'
      case 'pending': return 'warning'
      default: return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: locale === 'ru' ? 'Активный' : 'Active',
      pending: locale === 'ru' ? 'Ожидание' : 'Pending',
      new: locale === 'ru' ? 'Новый' : 'New',
    }
    return labels[status] || status
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 font-bold'
    if (score >= 70) return 'text-amber-600 font-bold'
    return 'text-text-secondary'
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleVerify = () => {
    if (selectedIds.length === 0) {
      addToast(locale === 'ru' ? 'Выберите хотя бы одну компанию!' : 'Select at least one company!', 'error')
      return
    }
    verifyCompanies(selectedIds)
    setIsModalOpen(false)
    setSelectedIds([])
  }

  const handleExport = () => {
    exportCompaniesReport()
    addToast(locale === 'ru' ? 'Отчёт скачан' : 'Report downloaded', 'success')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('companies.title')}</h1>
          <p className="text-text-secondary mt-1">{t('companies.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download size={16} className="mr-2" />
            {t('companies.export')}
          </Button>
          <Button variant="secondary" size="sm">
            <Building2 size={16} className="mr-2" />
            {t('companies.top100')}
          </Button>
          <Button 
            size="sm" 
            onClick={() => setIsModalOpen(true)} 
            disabled={selectedIds.length === 0 || isVerifying}
          >
            {isVerifying && <Loader2 size={16} className="mr-2 animate-spin" />}
            <Check size={16} className="mr-2" />
            {t('companies.verify')} ({selectedIds.length})
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input
              type="text"
              placeholder={t('companies.search')}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm bg-white">
            <option value="all">{t('companies.filters.size')}</option>
            <option value="large">{locale === 'ru' ? 'Крупные' : 'Large'}</option>
            <option value="medium">{locale === 'ru' ? 'Средние' : 'Medium'}</option>
            <option value="small">{locale === 'ru' ? 'Малые' : 'Small'}</option>
          </select>
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm bg-white">
            <option value="all">{t('companies.filters.region')}</option>
            <option value="Москва">{locale === 'ru' ? 'Москва' : 'Moscow'}</option>
            <option value="Екатеринбург">{locale === 'ru' ? 'Екатеринбург' : 'Yekaterinburg'}</option>
          </select>
          <select value={stackFilter} onChange={(e) => setStackFilter(e.target.value)} className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm bg-white">
            <option value="all">{t('companies.filters.stack')}</option>
            <option value="Python">Python</option>
            <option value="Java">Java</option>
            <option value="Go">Go</option>
            <option value="JavaScript">JavaScript</option>
          </select>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-text-secondary">
            <Loader2 className="animate-spin mr-2" /> {t('common.loading')}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left w-10"></th>
                    <th className="px-4 py-3 text-left font-medium text-text-secondary">
                      <button className="flex items-center gap-1 hover:text-text-primary">{t('companies.table.company')}<ArrowUpDown size={14} /></button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-text-secondary">{t('companies.table.industry')}</th>
                    <th className="px-4 py-3 text-left font-medium text-text-secondary">{t('companies.table.scoring')}</th>
                    <th className="px-4 py-3 text-left font-medium text-text-secondary">{t('companies.table.region')}</th>
                    <th className="px-4 py-3 text-left font-medium text-text-secondary">{t('companies.table.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {companies.map((company) => (
                    <tr key={company.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          className="rounded border-border cursor-pointer" 
                          checked={selectedIds.includes(company.id)} 
                          onChange={() => toggleSelect(company.id)} 
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">{company.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{company.industry}</td>
                      <td className="px-4 py-3"><span className={getScoreColor(company.score)}>{company.score} / 100</span></td>
                      <td className="px-4 py-3 text-text-secondary">{company.region}</td>
                      <td className="px-4 py-3">
                        <Badge variant={getStatusVariant(company.status)}>{getStatusLabel(company.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border flex justify-between text-xs text-text-secondary">
              <span>{locale === 'ru' ? `Показано ${companies.length} из ${total}` : `Showing ${companies.length} of ${total}`}</span>
            </div>
          </>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={locale === 'ru' ? 'Верификация Шорт-листа (Критическая точка №2)' : 'Shortlist Verification'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleVerify} disabled={isVerifying}>
              {isVerifying && <Loader2 size={16} className="mr-2 animate-spin" />}
              {locale === 'ru' ? 'Утвердить и продолжить' : 'Approve and Continue'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">{locale === 'ru' ? 'Внимание!' : 'Attention!'}</p>
              <p>{locale === 'ru' ? 'Бэкенд запустит процесс скоринга и подготовки писем.' : 'Backend will run scoring and letter preparation.'}</p>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">{t('companies.table.company')}</th>
                  <th className="px-3 py-2 text-right">{t('companies.table.scoring')}</th>
                </tr>
              </thead>
              <tbody>
                {companies.filter(c => selectedIds.includes(c.id)).map(c => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-right font-bold text-green-600">{c.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  )
}