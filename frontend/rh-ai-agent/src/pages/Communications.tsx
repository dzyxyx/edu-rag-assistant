import { useState } from 'react'
import { useOutreach } from '@/hooks/useOutreach'
import { useAppStore } from '@/store/useAppStore'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Mail, CheckCircle2, XCircle, Calendar, Clock, Send, Sparkles, ThumbsUp, ThumbsDown, Download, BookOpen, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { exportPartnerMaterials } from '@/lib/export'
import type { OutreachCard } from '@/api/types'

export default function Communications() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const { addToast } = useAppStore()
  
  // Используем хук для получения данных из API
  const { 
    cards, 
    isLoading, 
    moveStatus, 
    generateLetter, 
    saveAgreement, 
    giveFeedback, 
    isGenerating 
  } = useOutreach()

  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false)
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false)
  const [meetingSummary, setMeetingSummary] = useState('')
  const [agreementText, setAgreementText] = useState('')
  const [expandedCard, setExpandedCard] = useState<number | null>(null)

  // Конфигурация колонок Kanban
  const columns = [
    { id: 'draft' as const, key: 'draft' },
    { id: 'sent' as const, key: 'sent' },
    { id: 'interest' as const, key: 'interest' },
    { id: 'rejected' as const, key: 'rejected' },
    { id: 'meeting' as const, key: 'meeting' }
  ]

  const getColumnCards = (status: typeof columns[number]['id']) => 
    cards.filter(card => card.status === status)

  const handleGenerateLetter = async (cardId: number) => {
    try {
      await generateLetter({ id: cardId, tone: agentConfig.tone })
      setSelectedCard(cardId)
      setIsLetterModalOpen(true)
    } catch (err) {
      addToast(t('communications.letter.error'), 'error')
    }
  }

  const handleSend = (cardId: number) => {
    moveStatus({ id: cardId, status: 'sent' })
    setIsLetterModalOpen(false)
    addToast(locale === 'ru' ? 'Письмо отправлено' : 'Letter sent', 'success')
  }

  const handleOpenMeetingModal = (cardId: number) => {
    setSelectedCard(cardId)
    setMeetingSummary('')
    setAgreementText('')
    setIsMeetingModalOpen(true)
  }

  const handleSaveAgreement = () => {
    if (selectedCard && meetingSummary) {
      saveAgreement({ id: selectedCard, summary: meetingSummary, text: agreementText })
      setIsMeetingModalOpen(false)
    }
  }

  const getStatusIcon = (status: typeof columns[number]['id']) => {
    const icons = {
      draft: Mail,
      sent: Clock,
      interest: CheckCircle2,
      rejected: XCircle,
      meeting: Calendar
    }
    return icons[status]
  }

  const getStatusLabel = (status: typeof columns[number]['id']) => {
    const labels = {
      draft: t('communications.columns.draft'),
      sent: t('communications.columns.sent'),
      interest: t('communications.columns.interest'),
      rejected: t('communications.columns.rejected'),
      meeting: t('communications.columns.meeting')
    }
    return labels[status]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('communications.title')}</h1>
          <p className="text-text-secondary mt-1">{t('communications.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportPartnerMaterials()}>
            <BookOpen size={16} className="mr-2" />
            {t('communications.generateMaterials')}
          </Button>
        </div>
      </div>

      {/* Tone Selector */}
      <Card className="p-3 flex items-center gap-4">
        <span className="text-sm font-medium text-text-secondary">{t('communications.tone')}</span>
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button 
            onClick={() => setTone('formal')} 
            className={`px-3 py-1 text-xs rounded-md transition-all ${agentConfig.tone === 'formal' ? 'bg-white shadow text-primary font-bold' : 'text-text-secondary'}`}
          >
            {t('communications.formal')}
          </button>
          <button 
            onClick={() => setTone('informal')} 
            className={`px-3 py-1 text-xs rounded-md transition-all ${agentConfig.tone === 'informal' ? 'bg-white shadow text-primary font-bold' : 'text-text-secondary'}`}
          >
            {t('communications.informal')}
          </button>
        </div>
        <span className="text-xs text-text-secondary ml-auto">{t('communications.model')} {agentConfig.model}</span>
      </Card>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-text-secondary">
          <Loader2 className="animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : (
        /* Kanban Board */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const columnCards = getColumnCards(col.id)
            const Icon = getStatusIcon(col.id)
            
            return (
              <Card key={col.id} className="bg-slate-50 p-0 overflow-hidden min-w-[280px] flex flex-col">
                <div className="p-3 border-b border-border/50 flex items-center justify-between bg-white/50">
                  <div className="flex items-center gap-2 font-semibold text-sm text-text-primary">
                    <Icon size={16} />
                    {getStatusLabel(col.id)}
                  </div>
                  <Badge variant="default">{columnCards.length}</Badge>
                </div>
                
                <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                  {columnCards.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary text-sm opacity-50">
                      {locale === 'ru' ? 'Нет карточек' : 'No cards'}
                    </div>
                  ) : (
                    columnCards.map((card) => (
                      <div key={card.id} className="bg-white rounded-lg p-3 shadow-sm border border-border hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-sm text-text-primary">{card.company_name}</h4>
                          <span className="text-xs text-text-secondary">{new Date(card.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        <p className="text-xs text-text-secondary mb-2 line-clamp-2">{card.contact_person || (locale === 'ru' ? 'Контакт не указан' : 'No contact')}</p>
                        <p className="text-xs text-text-secondary border-t border-border pt-2 mb-3">{card.last_message || (locale === 'ru' ? 'Нет сообщений' : 'No messages')}</p>

                        {/* Agreement Status */}
                        {card.status === 'meeting' && card.agreement_signed && (
                          <div className="mb-2 flex items-center gap-1 text-xs text-green-600 bg-green-50 p-1 rounded">
                            <CheckCircle2 size={12} />
                            <span>{locale === 'ru' ? 'Соглашение зафиксировано' : 'Agreement saved'}</span>
                          </div>
                        )}

                        {/* Follow-ups */}
                        {card.follow_ups && card.follow_ups.length > 0 && (
                          <div className="mb-3">
                            <button 
                              onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)} 
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              {expandedCard === card.id ? '▲' : '▼'}
                              {locale === 'ru' ? `План касаний (${card.follow_ups.length})` : `Follow-up plan (${card.follow_ups.length})`}
                            </button>
                            {expandedCard === card.id && (
                              <div className="mt-2 space-y-1">
                                {card.follow_ups.map((fu, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded border border-border">
                                    <div className={`w-2 h-2 rounded-full ${fu.status === 'done' ? 'bg-green-500' : fu.status === 'sent' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                    <span className="text-text-secondary">{locale === 'ru' ? `День +${fu.day}:` : `Day +${fu.day}:`}</span>
                                    <span className="font-medium">{fu.task}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Feedback Buttons */}
                        {card.status === 'interest' && !card.feedback && (
                          <div className="flex gap-1 mb-2 border-t pt-2">
                            <span className="text-xs text-gray-500 mr-auto">{t('communications.actions.reaction')}</span>
                            <button onClick={(e) => { e.stopPropagation(); giveFeedback({ id: card.id, feedback: 'positive' }) }} className="p-1 hover:bg-green-50 rounded">
                              <ThumbsUp size={12} className="text-green-600"/>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); giveFeedback({ id: card.id, feedback: 'negative' }) }} className="p-1 hover:bg-red-50 rounded">
                              <ThumbsDown size={12} className="text-red-600"/>
                            </button>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-1 mt-auto" onClick={(e) => e.stopPropagation()}>
                          {card.status === 'draft' && (
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="flex-1 text-xs h-7"
                              onClick={() => handleGenerateLetter(card.id)}
                              disabled={isGenerating}
                            >
                              {isGenerating && <Loader2 size={12} className="mr-1 animate-spin" />}
                              <Sparkles size={12} className="mr-1" />
                              {t('communications.actions.generate')}
                            </Button>
                          )}
                          
                          {card.status === 'sent' && (
                            <div className="flex gap-1 w-full">
                              <button 
                                className="flex-1 text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
                                onClick={() => moveStatus({ id: card.id, status: 'interest' })}
                              >
                                {t('communications.actions.interest')}
                              </button>
                              <button 
                                className="flex-1 text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                                onClick={() => moveStatus({ id: card.id, status: 'rejected' })}
                              >
                                {t('communications.actions.reject')}
                              </button>
                            </div>
                          )}

                          {card.status === 'interest' && (
                            <Button 
                              size="sm" 
                              className="w-full text-xs h-7"
                              onClick={() => handleOpenMeetingModal(card.id)}
                            >
                              <Calendar size={12} className="mr-1" />
                              {t('communications.actions.meeting')}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Letter Modal */}
      <Modal
        isOpen={isLetterModalOpen}
        onClose={() => setIsLetterModalOpen(false)}
        title={t('communications.letter.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsLetterModalOpen(false)}>
              {t('communications.letter.close')}
            </Button>
            <Button onClick={() => selectedCard && handleSend(selectedCard)}>
              <Send size={16} className="mr-2" />
              {t('communications.letter.send')}
            </Button>
          </>
        }
      >
        {selectedCard && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-border">
              <p className="text-xs text-text-secondary mb-1">{t('communications.letter.recipient')}</p>
              <p className="text-sm font-medium">
                {cards.find(c => c.id === selectedCard)?.company_name || (locale === 'ru' ? 'Компания' : 'Company')}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t('communications.letter.label')} ({agentConfig.tone === 'formal' ? (locale === 'ru' ? 'Формальный' : 'Formal') : (locale === 'ru' ? 'Неформальный' : 'Informal')})
              </label>
              <textarea
                className="w-full h-64 p-3 border border-border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                defaultValue={cards.find(c => c.id === selectedCard)?.letter_draft || ''}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Agreement Modal */}
      <Modal
        isOpen={isMeetingModalOpen}
        onClose={() => setIsMeetingModalOpen(false)}
        title={t('meeting.modal.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsMeetingModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveAgreement} disabled={!meetingSummary}>
              <CheckCircle2 size={16} className="mr-2" />
              {t('meeting.modal.confirmBtn')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t('meeting.modal.summaryLabel')} <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full h-24 p-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light resize-none"
              placeholder={t('meeting.modal.summaryPlaceholder')}
              value={meetingSummary}
              onChange={(e) => setMeetingSummary(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t('meeting.modal.agreementLabel')}
            </label>
            <textarea
              className="w-full h-32 p-3 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-light resize-none"
              placeholder={t('meeting.modal.agreementPlaceholder')}
              value={agreementText}
              onChange={(e) => setAgreementText(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}