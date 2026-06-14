import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { communicationsApi, companiesApi, outreachApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { 
  Loader2, Plus, MoreVertical, Calendar, User, Building2,
  MessageSquare, TrendingUp, X, CheckCircle, Clock, AlertCircle,
  Sparkles, Copy, Check, Info
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import type { 
  OutreachCard, 
  CommunicationType, 
  CommunicationGenerateRequest,
  CommunicationGenerateResponse 
} from '@/api/types'

type CommunicationStatus = 'draft' | 'sent' | 'interest' | 'rejected' | 'meeting'

interface Column {
  id: CommunicationStatus
  title: string
  color: string
}

const COLUMNS: Column[] = [
  { id: 'draft', title: 'Черновики', color: 'bg-slate-100' },
  { id: 'sent', title: 'Отправлено', color: 'bg-blue-50' },
  { id: 'interest', title: 'Есть интерес', color: 'bg-green-50' },
  { id: 'rejected', title: 'Отказ', color: 'bg-red-50' },
  { id: 'meeting', title: 'Назначена встреча', color: 'bg-purple-50' },
]

const STATUS_LABELS: Record<CommunicationStatus, string> = {
  'draft': 'Черновик',
  'sent': 'Отправлено',
  'interest': 'Интерес',
  'rejected': 'Отказ',
  'meeting': 'Встреча',
}

export default function Communications() {
  const { i18n } = useTranslation()
  const { addToast } = useAppStore()
  const queryClient = useQueryClient()
  
  const [selectedCard, setSelectedCard] = useState<OutreachCard | null>(null)
  const [isCardModalOpen, setIsCardModalOpen] = useState(false)
  
  // Состояние для формы генерации
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('')
  const [companyId, setCompanyId] = useState<number | undefined>()
  const [tone, setTone] = useState<'formal' | 'informal'>('formal')
  const [useMemory, setUseMemory] = useState(true)
  const [generatedResult, setGeneratedResult] = useState<CommunicationGenerateResponse | null>(null)
  
  // Дополнительные поля
  const [previousSubject, setPreviousSubject] = useState('')
  const [followUpNumber, setFollowUpNumber] = useState(1)
  const [reason, setReason] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [recipientRole, setRecipientRole] = useState('')
  const [message, setMessage] = useState('')

  // Загрузка данных
  const { data: cards, isLoading: isLoadingCards } = useQuery({
    queryKey: ['outreach', 'cards'],
    queryFn: () => outreachApi.list().then(res => res.data),
    staleTime: 2 * 60 * 1000,
  })

  const { data: companiesData } = useQuery({
    queryKey: ['companies', 'list'],
    queryFn: () => companiesApi.list({ limit: 200 }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: typesData, isLoading: isLoadingTypes } = useQuery({
    queryKey: ['communications', 'types'],
    queryFn: () => communicationsApi.getTypes().then(res => res.data),
    staleTime: 30 * 60 * 1000,
  })

  const companiesList = companiesData?.items || []
  const allCards = cards || []
  const types = typesData?.items || []

  const cardsByStatus = allCards.reduce((acc, card) => {
    if (!acc[card.status]) acc[card.status] = []
    acc[card.status].push(card)
    return acc
  }, {} as Record<CommunicationStatus, OutreachCard[]>)

  const getCompany = (companyId: number) => companiesList.find(c => c.id === companyId)
  const selectedTypeData = types.find(t => t.type === selectedType)

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  // Мутация для генерации
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedType) throw new Error('Тип не выбран')
      
      const requestData: CommunicationGenerateRequest = {
        type: selectedType as any,
        tone,
        use_memory: useMemory,
      }

      if (selectedTypeData?.requires_company && companyId) {
        requestData.company_id = companyId
      }

      if (selectedType === 'follow_up') {
        requestData.previous_subject = previousSubject
        requestData.follow_up_number = followUpNumber
      } else if (selectedType === 'rejection') {
        requestData.reason = reason
      } else if (selectedType === 'project_invitation') {
        requestData.project_name = projectName
        requestData.project_description = projectDescription
      } else if (selectedType === 'notification') {
        requestData.recipient_role = recipientRole
        requestData.message = message
      }

      return communicationsApi.generate(requestData).then(res => res.data)
    },
    onSuccess: (data) => {
      setGeneratedResult(data)
      addToast('Текст сгенерирован', 'success')
    },
    onError: (error: any) => {
      let msg = 'Ошибка при генерации'
      if (error.response?.status === 422) msg = 'Проверьте заполнение полей'
      else if (error.response?.status === 404) msg = 'Компания не найдена'
      else if (error.response?.status === 503) msg = 'Генерация временно недоступна'
      addToast(msg, 'error')
    },
  })

  const handleGenerate = () => {
    if (!selectedType) {
      addToast('Выберите тип коммуникации', 'error')
      return
    }
    if (selectedTypeData?.requires_company && !companyId) {
      addToast('Выберите компанию', 'error')
      return
    }
    generateMutation.mutate()
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    addToast('Скопировано', 'success')
  }

  const resetGenerateForm = () => {
    setSelectedType('')
    setCompanyId(undefined)
    setTone('formal')
    setUseMemory(true)
    setPreviousSubject('')
    setFollowUpNumber(1)
    setReason('')
    setProjectName('')
    setProjectDescription('')
    setRecipientRole('')
    setMessage('')
    setGeneratedResult(null)
  }

  const handleCardClick = (card: OutreachCard) => {
    setSelectedCard(card)
    setIsCardModalOpen(true)
  }

  const getStatusBadge = (status: CommunicationStatus) => {
    const config: Record<CommunicationStatus, { variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive'; label: string }> = {
      'draft': { variant: 'secondary', label: 'Черновик' },
      'sent': { variant: 'default', label: 'Отправлено' },
      'interest': { variant: 'success', label: 'Интерес' },
      'rejected': { variant: 'destructive', label: 'Отказ' },
      'meeting': { variant: 'warning', label: 'Встреча' },
    }
    return <Badge variant={config[status].variant} className="text-xs">{config[status].label}</Badge>
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'outreach': 'Первичное письмо',
      'follow_up': 'Напоминание',
      'rejection': 'Отказ',
      'project_invitation': 'Приглашение к проекту',
      'notification': 'Уведомление',
    }
    return labels[type] || type
  }

  if (isLoadingCards) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 md:px-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">CRM — Управление коммуникациями</h1>
          <p className="text-text-secondary mt-1 text-sm">Фазы 3 и 4. Генерация писем и ведение воронки</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => {
          resetGenerateForm()
          setIsGenerateModalOpen(true)
        }}>
          <Plus size={16} />
          Новая коммуникация
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-250px)]">
        {COLUMNS.map((column) => {
          const columnCards = cardsByStatus[column.id] || []
          return (
            <div key={column.id} className={`flex-shrink-0 w-80 ${column.color} rounded-xl p-3 flex flex-col max-h-[calc(100vh-280px)]`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-semibold text-sm text-text-primary">{column.title}</h3>
                <Badge variant="secondary" className="text-xs">{columnCards.length}</Badge>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {columnCards.map((card) => {
                  const company = getCompany(card.company_id)
                  return (
                    <Card key={card.id} className="p-3 bg-white hover:shadow-md transition-shadow cursor-pointer group" onClick={() => handleCardClick(card)}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Building2 size={14} className="text-text-secondary shrink-0" />
                          <h4 className="font-medium text-sm text-text-primary truncate">{company?.name || card.company_name}</h4>
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-100 rounded">
                          <MoreVertical size={14} className="text-text-secondary" />
                        </button>
                      </div>
                      {card.meeting_summary && <p className="text-xs text-text-secondary mb-2 line-clamp-2">{card.meeting_summary}</p>}
                      {card.letter_draft && <p className="text-xs text-text-secondary mb-2 line-clamp-2">{card.letter_draft.slice(0, 80)}...</p>}
                      {card.contact_person && (
                        <div className="flex items-center gap-1.5 mb-2 text-xs text-text-secondary">
                          <User size={12} className="shrink-0" />
                          <span className="truncate">{card.contact_person}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        {card.last_message && (
                          <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                            <MessageSquare size={10} /><span>Переписка</span>
                          </div>
                        )}
                        {card.agreement_signed && (
                          <div className="flex items-center gap-1 text-[10px] text-green-600">
                            <CheckCircle size={10} /><span>Соглашение</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-text-secondary ml-auto">
                          <Calendar size={10} /><span>{formatDate(card.updated_at)}</span>
                        </div>
                      </div>
                    </Card>
                  )
                })}
                {columnCards.length === 0 && <div className="text-center py-8 text-xs text-text-secondary opacity-60">Нет карточек</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal: Генерация коммуникации */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Новая коммуникация"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsGenerateModalOpen(false)}>Закрыть</Button>
            {!generatedResult && (
              <Button onClick={handleGenerate} disabled={generateMutation.isPending || !selectedType}>
                {generateMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Sparkles size={16} className="mr-2" />}
                Сгенерировать
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {/* Если результат есть — показываем его */}
          {generatedResult ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Info size={16} className="text-blue-600 shrink-0" />
                <p className="text-sm text-blue-800">
                  Агент учёл {generatedResult.memory_used_count} записей из истории
                </p>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-text-secondary">Тема</label>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(generatedResult.subject)} className="h-7 px-2">
                    <Copy size={14} className="mr-1" />Копировать
                  </Button>
                </div>
                <div className="p-3 bg-slate-50 border border-border rounded-lg">
                  <p className="text-sm font-medium text-text-primary">{generatedResult.subject}</p>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-text-secondary">Текст</label>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(generatedResult.body)} className="h-7 px-2">
                    <Copy size={14} className="mr-1" />Копировать
                  </Button>
                </div>
                <div className="p-4 bg-slate-50 border border-border rounded-lg min-h-[200px] max-h-[300px] overflow-y-auto">
                  <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{generatedResult.body}</p>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => {
                  setGeneratedResult(null)
                  resetGenerateForm()
                }}>
                  Сгенерировать ещё
                </Button>
                <Button onClick={() => {
                  handleCopy(`${generatedResult.subject}\n\n${generatedResult.body}`)
                  setIsGenerateModalOpen(false)
                }}>
                  <Check size={16} className="mr-2" />Готово
                </Button>
              </div>
            </div>
          ) : (
            /* Форма генерации */
            <div className="space-y-4">
              {/* Тип коммуникации */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Тип коммуникации</label>
                {isLoadingTypes ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={20} /></div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {types.map((typeItem: CommunicationType) => (
                      <button
                        key={typeItem.type}
                        onClick={() => {
                          setSelectedType(typeItem.type)
                          if (!typeItem.requires_company) setCompanyId(undefined)
                        }}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selectedType === typeItem.type ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm text-text-primary">{getTypeLabel(typeItem.type)}</p>
                            <p className="text-xs text-text-secondary mt-1">{typeItem.description}</p>
                          </div>
                          {selectedType === typeItem.type && <Check size={16} className="text-primary shrink-0 ml-2" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Параметры */}
              {selectedType && (
                <div className="space-y-3 pt-2 border-t">
                  {selectedTypeData?.requires_company && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">Компания <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                        <select
                          value={companyId || ''}
                          onChange={(e) => setCompanyId(Number(e.target.value))}
                          className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
                        >
                          <option value="">Выберите компанию</option>
                          {companiesList.map((company: any) => (
                            <option key={company.id} value={company.id}>{company.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Тон общения</label>
                    <div className="flex gap-2">
                      {(['formal', 'informal'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTone(t)}
                          className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                            tone === t ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-slate-50'
                          }`}
                        >
                          {t === 'formal' ? 'Официальный' : 'Неформальный'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedType !== 'notification' && (
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" checked={useMemory} onChange={(e) => setUseMemory(e.target.checked)} className="w-4 h-4 rounded" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">Использовать память агента</p>
                        <p className="text-xs text-text-secondary">Контекст из истории взаимодействий</p>
                      </div>
                      {useMemory && <Sparkles size={16} className="text-primary" />}
                    </label>
                  )}

                  {/* Доп. поля */}
                  {selectedType === 'follow_up' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">Тема предыдущего письма</label>
                        <input type="text" value={previousSubject} onChange={(e) => setPreviousSubject(e.target.value)} className="w-full px-4 py-2 border border-border rounded-lg text-sm" placeholder="Например: Предложение о партнёрстве" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">Номер напоминания</label>
                        <input type="number" value={followUpNumber} onChange={(e) => setFollowUpNumber(Number(e.target.value))} min={1} max={10} className="w-full px-4 py-2 border border-border rounded-lg text-sm" />
                      </div>
                    </>
                  )}

                  {selectedType === 'rejection' && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">Причина отказа</label>
                      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full px-4 py-2 border border-border rounded-lg text-sm resize-none" placeholder="Кратко опишите причину..." />
                    </div>
                  )}

                  {selectedType === 'project_invitation' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">Название проекта</label>
                        <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full px-4 py-2 border border-border rounded-lg text-sm" placeholder="Например: Разработка мобильного приложения" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">Описание проекта</label>
                        <textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} rows={3} className="w-full px-4 py-2 border border-border rounded-lg text-sm resize-none" placeholder="Опишите цели и задачи..." />
                      </div>
                    </>
                  )}

                  {selectedType === 'notification' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">Роль получателя</label>
                        <input type="text" value={recipientRole} onChange={(e) => setRecipientRole(e.target.value)} className="w-full px-4 py-2 border border-border rounded-lg text-sm" placeholder="Например: Менеджер проекта" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">Текст сообщения</label>
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full px-4 py-2 border border-border rounded-lg text-sm resize-none" placeholder="Введите текст уведомления..." />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/*Modal: Детали карточки */}
      <Modal isOpen={isCardModalOpen} onClose={() => setIsCardModalOpen(false)} title="Детали коммуникации" footer={
        <>
          <Button variant="secondary" onClick={() => setIsCardModalOpen(false)}>Закрыть</Button>
          <Button onClick={() => setIsCardModalOpen(false)}>Редактировать</Button>
        </>
      }>
        {selectedCard && (
          <div className="space-y-4">
            <div><label className="text-xs font-medium text-text-secondary">Компания</label><p className="text-sm font-medium text-text-primary mt-1">{getCompany(selectedCard.company_id)?.name || selectedCard.company_name}</p></div>
            <div><label className="text-xs font-medium text-text-secondary">Статус</label><div className="mt-1">{getStatusBadge(selectedCard.status)}</div></div>
            {selectedCard.contact_person && <div><label className="text-xs font-medium text-text-secondary">Контактное лицо</label><p className="text-sm text-text-primary mt-1">{selectedCard.contact_person}</p></div>}
            {selectedCard.contact_email && <div><label className="text-xs font-medium text-text-secondary">Email</label><p className="text-sm text-text-primary mt-1">{selectedCard.contact_email}</p></div>}
            {selectedCard.letter_draft && <div><label className="text-xs font-medium text-text-secondary">Черновик письма</label><div className="mt-1 p-3 bg-slate-50 rounded-lg"><p className="text-sm text-text-primary whitespace-pre-wrap">{selectedCard.letter_draft}</p></div></div>}
            {selectedCard.meeting_summary && <div><label className="text-xs font-medium text-text-secondary">Итоги встречи</label><div className="mt-1 p-3 bg-slate-50 rounded-lg"><p className="text-sm text-text-primary whitespace-pre-wrap">{selectedCard.meeting_summary}</p></div></div>}
            {selectedCard.follow_ups && selectedCard.follow_ups.length > 0 && (
              <div><label className="text-xs font-medium text-text-secondary mb-2">Напоминания ({selectedCard.follow_ups.length})</label>
                <div className="space-y-2">
                  {selectedCard.follow_ups.map((fu, i) => (
                    <div key={fu.id || i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <Clock size={14} className="text-text-secondary" />
                      <div className="flex-1"><p className="text-xs font-medium text-text-primary">{fu.task}</p><p className="text-[10px] text-text-secondary">День {fu.day} • {STATUS_LABELS[fu.status as CommunicationStatus]}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedCard.feedback && <div><label className="text-xs font-medium text-text-secondary">Обратная связь</label><div className="mt-1"><Badge variant={selectedCard.feedback === 'positive' ? 'success' : 'destructive'}>{selectedCard.feedback === 'positive' ? 'Позитивная' : 'Негативная'}</Badge></div></div>}
          </div>
        )}
      </Modal>
    </div>
  )
}