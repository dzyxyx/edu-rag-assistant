import { useState, useEffect } from 'react'
import { useChatSessions } from '@/hooks/useChatSessions'
import { Button } from './Button'
import { Badge } from './Badge'
import { MessageSquare, Plus, Trash2, Loader2, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectSession: (sessionId: number) => void
  onNewChat: () => void
  currentSessionId?: number | null
}

export function ChatSidebar({ 
  isOpen, 
  onClose, 
  onSelectSession, 
  onNewChat,
  currentSessionId 
}: ChatSidebarProps) {
  const { t, i18n } = useTranslation()
  const { sessions, isLoading, deleteSession } = useChatSessions()
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  // Закрытие по Esc
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  const handleDelete = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation()
    setIsDeleting(sessionId)
    try {
      await deleteSession(sessionId)
    } finally {
      setIsDeleting(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end pointer-events-none sm:p-4">
      {/* Затемнение фона */}
      <div 
        className="absolute inset-0 bg-black/30 sm:hidden pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Панель сессий */}
      <div className="relative w-80 h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-border flex flex-col pointer-events-auto animate-in slide-in-from-right-10 fade-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-card rounded-t-2xl">
          <h3 className="font-semibold text-text-primary flex items-center gap-2">
            <MessageSquare size={18} />
            {t('chat.sessions')}
          </h3>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onNewChat}
              className="h-8 w-8 p-0"
              title={t('chat.newChat')}
            >
              <Plus size={18} />
            </Button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronRight size={20} className="text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-text-secondary py-8 px-4">
              <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('chat.noSessions')}</p>
              <Button variant="secondary" size="sm" onClick={onNewChat} className="mt-3">
                <Plus size={14} className="mr-1" />
                {t('chat.startNew')}
              </Button>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  onSelectSession(session.id)
                  onClose()
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all group ${
                  currentSessionId === session.id
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-white border-border hover:bg-slate-50 hover:border-primary/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${
                      currentSessionId === session.id ? 'text-primary' : 'text-text-primary'
                    }`}>
                      {session.title || t('chat.untitled')}
                    </p>
                    {session.last_message && (
                      <p className="text-xs text-text-secondary truncate mt-0.5">
                        {session.last_message}
                      </p>
                    )}
                    <p className="text-[10px] text-text-secondary mt-1">
                      {formatDate(session.created_at)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {session.is_active && (
                      <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                        {t('chat.active')}
                      </Badge>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, session.id)}
                      disabled={isDeleting === session.id}
                      className="p-1 hover:bg-red-100 rounded text-red-500 disabled:opacity-50"
                      title={t('chat.deleteSession')}
                    >
                      {isDeleting === session.id 
                        ? <Loader2 size={14} className="animate-spin" /> 
                        : <Trash2 size={14} />
                      }
                    </button>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-slate-50 rounded-b-2xl">
          <Button variant="secondary" size="sm" onClick={onNewChat} className="w-full">
            <Plus size={16} className="mr-2" />
            {t('chat.newChat')}
          </Button>
        </div>
      </div>
    </div>
  )
}