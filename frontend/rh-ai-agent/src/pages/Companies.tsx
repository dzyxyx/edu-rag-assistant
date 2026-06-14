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
  History, BarChart3, Plus, Database, Clock, CheckCircle, XCircle,
  AlertCircle, Building, Mail, Phone, Link, Users, MapPin as MapPinIcon,
  Briefcase, FileText, CreditCard
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { Company, ScoreHistory, IngestLog, CompanyCreate } from '@/api/types'

const ImportStatusBadge = ({ status }: { status: IngestLog['status'] }) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  
  const config = {
    running: { icon: Loader2, className: 'bg-yellow-100 text-yellow-800', label: locale === 'ru' ? 'В процессе' : 'Running' },
    success: { icon: CheckCircle, className: 'bg-green-100 text-green-800', label: locale === 'ru' ? 'Успешно' : 'Success' },
    failed: { icon: XCircle, className: 'bg-red-100 text-red-800', label: locale === 'ru' ? 'Ошибка' : 'Failed' },
  }
  
  const { icon: Icon, className, label } = config[status]
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon size={12} className={status === 'running' ? 'animate-spin' : ''} />
      {label}
    </span>
  )
}

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
  
  const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState(false)
  const [isIngestLogsModalOpen, setIsIngestLogsModalOpen] = useState(false)
  const [ingestLogsOffset, setIngestLogsOffset] = useState(0)
  const INGEST_LOGS_LIMIT = 20
  
  const [newCompany, setNewCompany] = useState<CompanyCreate>({
    name: '',
    inn: '',
    website: '',
    description: '',
    industry: '',
    region: '',
    employee_count: undefined,
    email: '',
    phone: '',
    linkedin_url: '',
  })
  
  const { 
    data: companiesData, 
    isLoading, 
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['companies', filters.search, filters.status, filters.limit, filters.offset],
    queryFn: () => {
      console.log('🔍 Fetching companies with filters:', filters)
      return companiesApi.list(filters).then(res => {
        console.log('✅ Companies received:', res.data.total, 'items:', res.data.items.length)
        return res.data
      })
    },
    staleTime: 0, 
    gcTime: 0, 
    retry: 1,
  })

  const { data: scoreHistory } = useQuery({
    queryKey: ['companies', selectedCompanyForHistory?.id, 'score-history'],
    queryFn: () => selectedCompanyForHistory 
      ? companiesApi.getScoreHistory(selectedCompanyForHistory.id, { limit: 50, offset: 0 }).then(res => res.data)
      : Promise.resolve({ items: [], total: 0 }),
    enabled: !!selectedCompanyForHistory && isHistoryModalOpen,
    staleTime: 1 * 60 * 1000,
  })
  
  const { data: ingestLogsData } = useQuery({
    queryKey: ['ingest-logs', { offset: ingestLogsOffset, limit: INGEST_LOGS_LIMIT }],
    queryFn: () => companiesApi.getIngestLogs({ limit: INGEST_LOGS_LIMIT, offset: ingestLogsOffset }).then(res => res.data),
    enabled: isIngestLogsModalOpen,
    staleTime: 30 * 1000,
  })

  const createCompanyMutation = useMutation({
    mutationFn: (data: CompanyCreate) => companiesApi.create(data),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      addToast(
        locale === 'ru' 
          ? `Компания "${response.data.name}" успешно добавлена` 
          : `Company "${response.data.name}" created successfully`, 
        'success'
      )
      setIsAddCompanyModalOpen(false)
      setNewCompany({
        name: '',
        inn: '',
        website: '',
        description: '',
        industry: '',
        region: '',
        employee_count: undefined,
        email: '',
        phone: '',
        linkedin_url: '',
      })
      refetch()
    },
    onError: (error: any) => {
      if (error.response?.status === 409) {
        const detail = error.response?.data?.detail || ''
        const idMatch = detail.match(/id=(\d+)/)
        const nameMatch = detail.match(/name='([^']+)'/)
        
        if (idMatch) {
          const existingId = parseInt(idMatch[1])
          const existingName = nameMatch?.[1] || ''
          
          addToast(
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-yellow-500" />
                <span>
                  {locale === 'ru' 
                    ? `Компания "${existingName}" уже существует` 
                    : `Company "${existingName}" already exists`}
                </span>
              </div>
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => {
                  addToast(locale === 'ru' ? 'Переход к компании' : 'Navigating to company', 'info')
                }}
              >
                {locale === 'ru' ? 'Перейти' : 'Go'}
              </Button>
            </div>,
            'warning',
            10000
          )
        } else {
          addToast(detail, 'warning')
        }
      } else {
        addToast(
          error.response?.data?.detail || error.message || (locale === 'ru' ? 'Ошибка добавления компании' : 'Error creating company'), 
          'error'
        )
      }
    },
  })

  const companies = companiesData?.items || []
  const total = companiesData?.total || 0
  
  console.log('📊 Render state:', { 
    offset: filters.offset, 
    limit: filters.limit,
    companiesLength: companies.length,
    total,
    isLoading,
    isFetching,
    hasData: !!companiesData
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput, offset: 0 }))
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const currentPage = Math.floor(filters.offset / filters.limit) + 1
  const totalPages = total > 0 ? Math.ceil(total / filters.limit) : 1
  
  const goToNextPage = () => {
    const newOffset = filters.offset + filters.limit
    console.log('➡️ Next page:', { currentOffset: filters.offset, newOffset, currentPage, totalPages })
    if (currentPage < totalPages) {
      setFilters(prev => ({ ...prev, offset: newOffset }))
    }
  }
  
  const goToPrevPage = () => {
    const newOffset = Math.max(0, filters.offset - filters.limit)
    console.log('⬅️ Previous page:', { currentOffset: filters.offset, newOffset, currentPage })
    if (currentPage > 1) {
      setFilters(prev => ({ ...prev, offset: newOffset }))
    }
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
    if (selectedCompanies.length === companies.length && companies.length > 0) {
      setSelectedCompanies([])
    } else {
      setSelectedCompanies(companies.map(c => c.id))
    }
  }

  const handleCreateCompany = () => {
    if (!newCompany.name.trim()) {
      addToast(locale === 'ru' ? 'Название компании обязательно' : 'Company name is required', 'warning')
      return
    }
    createCompanyMutation.mutate(newCompany)
  }

  const verifyMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (isVerifyingRef.current) {
        throw new Error('Already verifying')
      }
      isVerifyingRef.current = true
      try {
        const results = await Promise.all(
          ids.map(id => companiesApi.updateStatus(id, { status: 'verified' }))
        )
        return results
      } finally {
        isVerifyingRef.current = false
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      await refetch()
      addToast(locale === 'ru' ? 'Компании успешно верифицированы' : 'Companies verified successfully', 'success')
    },
    onError: (error: any) => {
      if (error.message === 'Already verifying') return
      addToast(error.response?.data?.detail || error.message || (locale === 'ru' ? 'Не удалось верифицировать' : 'Verification failed'), 'error')
    },
  })

  const scoreMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (isScoringRef.current) {
        throw new Error('Already scoring')
      }
      isScoringRef.current = true
      try {
        const results = await Promise.all(
          ids.map(id => companiesApi.rescoreCompany(id))
        )
        return results
      } finally {
        isScoringRef.current = false
      }
    },
    onSuccess: async (results) => {
      const updated = results.filter(r => r.data?.status === 'shortlisted').length
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      await refetch()
      if (updated > 0) {
        addToast(
          locale === 'ru' 
            ? `Скоринг завершён. ${updated} компаний в шорт-листе`
            : `Scoring completed. ${updated} companies shortlisted`,
          'success'
        )
      } else {
        addToast(locale === 'ru' ? 'Скоринг завершён' : 'Scoring completed', 'success')
      }
    },
    onError: (error: any) => {
      if (error.message === 'Already scoring') return
      addToast(error.response?.data?.detail || error.message || (locale === 'ru' ? 'Не удалось пересчитать скоринг' : 'Scoring failed'), 'error')
    },
  })

  const singleScoreMutation = useMutation({
    mutationFn: async (companyId: number) => {
      if (isScoringRef.current) {
        throw new Error('Already scoring')
      }
      isScoringRef.current = true
      try {
        const response = await companiesApi.rescoreCompany(companyId)
        return response
      } finally {
        isScoringRef.current = false
      }
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      await refetch()
      const newStatus = response.data?.status
      const score = Math.round((response.data?.score || 0) * 100)
      
      if (newStatus === 'shortlisted') {
        addToast(locale === 'ru' ? `Скоринг: ${score}/100 → В шорт-листе!` : `Score: ${score}/100 → Shortlisted!`, 'success')
      } else {
        addToast(locale === 'ru' ? `Скоринг: ${score}/100` : `Score: ${score}/100`, 'success')
      }
    },
    onError: (error: any) => {
      if (error.message === 'Already scoring') return
      addToast(error.message || (locale === 'ru' ? 'Ошибка скоринга' : 'Scoring error'), 'error')
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
      ? <Badge variant="info" className="text-xs">{locale === 'ru' ? 'Ручной' : 'Manual'}</Badge>
      : <Badge variant="secondary" className="text-xs">{locale === 'ru' ? 'Автоматический' : 'Auto'}</Badge>
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-slate-200 rounded animate-pulse mt-2" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-40 bg-slate-200 rounded animate-pulse" />
            <div className="h-10 w-32 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
        <Card className="p-4">
          <div className="h-12 bg-slate-200 rounded animate-pulse" />
        </Card>
        <Card className="p-0 overflow-hidden">
          <TableSkeleton />
        </Card>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{t('companies.title')}</h1>
          </div>
        </div>
        <Card className="p-8 text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            {locale === 'ru' ? 'Ошибка загрузки данных' : 'Error loading data'}
          </h3>
          <p className="text-text-secondary mb-4">
            {error instanceof Error ? error.message : (locale === 'ru' ? 'Не удалось загрузить компании' : 'Failed to load companies')}
          </p>
          <Button onClick={() => refetch()}>
            {locale === 'ru' ? 'Повторить' : 'Retry'}
          </Button>
        </Card>
      </div>
    )
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
          <Button 
            variant="primary" 
            onClick={() => setIsAddCompanyModalOpen(true)}
          >
            <Plus size={16} className="mr-1" />
            {locale === 'ru' ? 'Добавить компанию' : 'Add Company'}
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => {
              setIngestLogsOffset(0)
              setIsIngestLogsModalOpen(true)
            }}
            size="sm"
          >
            <Database size={16} className="mr-1" />
            {locale === 'ru' ? 'История сбора' : 'Ingest Logs'}
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
                    disabled={isFetching}
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
            
            {isFetching && companies.length === 0 ? (
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
                    
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-sm font-medium">
                        <TrendingUp size={14} className="text-primary" />
                        {Math.round((company.score ?? 0) * 100)}/100
                      </div>
                    </td>
                    
                    <td className="px-4 py-3">{getStatusBadge(company.status)}</td>
                    
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2"
                          onClick={() => openHistoryModal(company)}
                          title={locale === 'ru' ? 'История скоринга' : 'Score History'}
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
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50">
            <div className="flex items-center gap-4">
              <span className="text-sm text-text-secondary">
                {locale === 'ru' 
                  ? `Показано ${companies.length} из ${total} компаний`
                  : `Showing ${companies.length} of ${total} companies`}
              </span>
              {isFetching && (
                <Loader2 size={16} className="animate-spin text-primary" />
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="secondary"
                disabled={currentPage === 1 || isFetching}
                onClick={goToPrevPage}
              >
                <ChevronLeft size={16} className="mr-1" />
                {locale === 'ru' ? 'Назад' : 'Previous'}
              </Button>
              <span className="px-3 py-1 text-sm text-text-secondary">
                {locale === 'ru' 
                  ? `Страница ${currentPage} из ${totalPages}`
                  : `Page ${currentPage} of ${totalPages}`}
              </span>
              <Button 
                size="sm" 
                variant="secondary"
                disabled={currentPage >= totalPages || isFetching}
                onClick={goToNextPage}
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

      {/* Add Company Modal */}
      <Modal
        isOpen={isAddCompanyModalOpen}
        onClose={() => !createCompanyMutation.isPending && setIsAddCompanyModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-primary" />
            {locale === 'ru' ? 'Добавление компании' : 'Add Company'}
          </div>
        }
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button 
              variant="secondary" 
              onClick={() => setIsAddCompanyModalOpen(false)}
              disabled={createCompanyMutation.isPending}
            >
              {locale === 'ru' ? 'Отмена' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleCreateCompany} 
              disabled={createCompanyMutation.isPending || !newCompany.name.trim()}
            >
              {createCompanyMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              {locale === 'ru' ? 'Добавить' : 'Add'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {locale === 'ru' ? 'Название компании *' : 'Company Name *'}
            </label>
            <div className="relative">
              <Building size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                placeholder={locale === 'ru' ? 'Например: ООО Ромашка' : 'Example: Romashka LLC'}
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {locale === 'ru' ? 'ИНН' : 'INN'}
            </label>
            <div className="relative">
              <CreditCard size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={newCompany.inn}
                onChange={(e) => setNewCompany({ ...newCompany, inn: e.target.value })}
                placeholder="1234567890"
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {locale === 'ru' ? 'Веб-сайт' : 'Website'}
            </label>
            <div className="relative">
              <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="url"
                value={newCompany.website}
                onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                placeholder="https://example.com"
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {locale === 'ru' ? 'Email' : 'Email'}
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="email"
                value={newCompany.email}
                onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                placeholder="hr@company.com"
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {locale === 'ru' ? 'Телефон' : 'Phone'}
            </label>
            <div className="relative">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="tel"
                value={newCompany.phone}
                onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })}
                placeholder="+7 (XXX) XXX-XX-XX"
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {locale === 'ru' ? 'LinkedIn URL' : 'LinkedIn URL'}
            </label>
            <div className="relative">
              <Link size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="url"
                value={newCompany.linkedin_url}
                onChange={(e) => setNewCompany({ ...newCompany, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/company/..."
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {locale === 'ru' ? 'Отрасль' : 'Industry'}
            </label>
            <div className="relative">
              <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={newCompany.industry}
                onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                placeholder={locale === 'ru' ? 'Например: Разработка ПО' : 'Example: Software Development'}
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {locale === 'ru' ? 'Регион' : 'Region'}
            </label>
            <div className="relative">
              <MapPinIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={newCompany.region}
                onChange={(e) => setNewCompany({ ...newCompany, region: e.target.value })}
                placeholder={locale === 'ru' ? 'Например: г. Екатеринбург' : 'Example: Moscow'}
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
            </div>
            <p className="text-xs text-text-secondary mt-1">
              {locale === 'ru' 
                ? 'Регион будет автоматически нормализован (например, "г. Екатеринбург" → "Екатеринбург")' 
                : 'Region will be automatically normalized'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {locale === 'ru' ? 'Количество сотрудников' : 'Employee Count'}
            </label>
            <div className="relative">
              <Users size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="number"
                value={newCompany.employee_count || ''}
                onChange={(e) => setNewCompany({ ...newCompany, employee_count: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="100"
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {locale === 'ru' ? 'Описание' : 'Description'}
            </label>
            <div className="relative">
              <FileText size={18} className="absolute left-3 top-3 text-text-secondary" />
              <textarea
                value={newCompany.description}
                onChange={(e) => setNewCompany({ ...newCompany, description: e.target.value })}
                placeholder={locale === 'ru' ? 'Краткое описание компании...' : 'Brief company description...'}
                rows={4}
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light resize-none"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Ingest Logs Modal */}
      <Modal
        isOpen={isIngestLogsModalOpen}
        onClose={() => setIsIngestLogsModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Database size={20} className="text-primary" />
            {locale === 'ru' ? 'История сбора данных' : 'Data Collection History'}
          </div>
        }
        size="xl"
        footer={
          <div className="flex justify-between items-center w-full">
            {ingestLogsData && (
              <span className="text-sm text-text-secondary">
                {locale === 'ru' 
                  ? `Всего запусков: ${ingestLogsData.total}` 
                  : `Total runs: ${ingestLogsData.total}`}
              </span>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setIsIngestLogsModalOpen(false)}>
                {locale === 'ru' ? 'Закрыть' : 'Close'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {!ingestLogsData ? (
            <div className="flex justify-center py-8">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : ingestLogsData.items.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <Database size={48} className="mx-auto mb-4 opacity-30" />
              <p>{locale === 'ru' ? 'История сбора данных пуста' : 'No data collection history'}</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {ingestLogsData.items.map((log) => (
                  <Card key={log.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <ImportStatusBadge status={log.status} />
                          <Badge variant="secondary" className="text-xs">
                            {log.source === 'manual_import' 
                              ? (locale === 'ru' ? 'Ручной импорт' : 'Manual Import')
                              : log.source === 'hh' 
                                ? 'HH.ru' 
                                : log.source}
                          </Badge>
                          <Badge variant="info" className="text-xs">
                            {log.trigger === 'manual' 
                              ? (locale === 'ru' ? 'Ручной' : 'Manual')
                              : (locale === 'ru' ? 'Плановый' : 'Scheduled')}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-text-secondary mb-2">
                          <Clock size={14} className="inline mr-1" />
                          {formatDate(log.started_at)}
                          {log.finished_at && ` → ${formatDate(log.finished_at)}`}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                          <div className="bg-green-50 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-green-700">{log.companies_created}</div>
                            <div className="text-xs text-green-600">{locale === 'ru' ? 'Создано' : 'Created'}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-blue-700">{log.companies_updated}</div>
                            <div className="text-xs text-blue-600">{locale === 'ru' ? 'Обновлено' : 'Updated'}</div>
                          </div>
                          <div className="bg-yellow-50 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-yellow-700">{log.skipped_duplicates}</div>
                            <div className="text-xs text-yellow-600">{locale === 'ru' ? 'Дубликаты' : 'Duplicates'}</div>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-purple-700">{log.vacancies_created}</div>
                            <div className="text-xs text-purple-600">{locale === 'ru' ? 'Вакансии' : 'Vacancies'}</div>
                          </div>
                        </div>
                        
                        {log.errors_count > 0 && log.error_message && (
                          <div className="mt-3 p-2 bg-red-50 rounded-lg text-sm text-red-700">
                            <div className="flex items-start gap-2">
                              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium">{locale === 'ru' ? 'Ошибок:' : 'Errors:'} {log.errors_count}</span>
                                {log.error_message && (
                                  <div className="text-xs text-red-600 mt-1">{log.error_message}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              {ingestLogsData.total > INGEST_LOGS_LIMIT && (
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-sm text-text-secondary">
                    {locale === 'ru' 
                      ? `Показано ${ingestLogsData.items.length} из ${ingestLogsData.total}`
                      : `Showing ${ingestLogsData.items.length} of ${ingestLogsData.total}`}
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="secondary"
                      disabled={ingestLogsOffset === 0}
                      onClick={() => setIngestLogsOffset(prev => Math.max(0, prev - INGEST_LOGS_LIMIT))}
                    >
                      <ChevronLeft size={16} className="mr-1" />
                      {locale === 'ru' ? 'Назад' : 'Previous'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      disabled={ingestLogsOffset + INGEST_LOGS_LIMIT >= ingestLogsData.total}
                      onClick={() => setIngestLogsOffset(prev => prev + INGEST_LOGS_LIMIT)}
                    >
                      {locale === 'ru' ? 'Вперёд' : 'Next'}
                      <ChevronRight size={16} className="ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
          <div className="space-y-6 max-h-[60vh] overflow-y-auto">
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
                    { key: locale === 'ru' ? 'Общий score' : 'Total Score', value: scoreHistory.items[0].score },
                    { key: 'Tech Stack', value: scoreHistory.items[0].score_tech_stack },
                    { key: 'Scale', value: scoreHistory.items[0].score_scale },
                    { key: 'Reputation', value: scoreHistory.items[0].score_reputation },
                    { key: locale === 'ru' ? 'Edu Experience' : 'Edu Experience', value: scoreHistory.items[0].score_edu_experience },
                    { key: locale === 'ru' ? 'Vacancy Activity' : 'Vacancy Activity', value: scoreHistory.items[0].score_vacancy_activity },
                    { key: locale === 'ru' ? 'Priority Bonus' : 'Priority Bonus', value: scoreHistory.items[0].priority_bonus },
                  ].map(({ key, value }) => (
                    <Card key={key} className="p-3">
                      <p className="text-xs text-text-secondary mb-1">{key}</p>
                      <p className="text-lg font-bold text-text-primary">
                        {typeof value === 'number' ? Math.round(value * 100) : 'N/A'}
                        {key !== (locale === 'ru' ? 'Priority Bonus' : 'Priority Bonus') && <span className="text-sm text-text-secondary">/100</span>}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

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