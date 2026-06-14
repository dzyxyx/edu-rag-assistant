import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, User, Loader2, MessageSquarePlus, MessageSquare, Trash2, ChevronLeft } from 'lucide-react'
import { Button } from './Button'
import { Badge } from './Badge'
import { useChat } from '@/hooks/useChat'
import { useChatSessions } from '@/hooks/useChatSessions'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'

interface ChatWindowProps {
  isOpen: boolean
  onClose: () => void
}

export function ChatWindow({ isOpen, onClose }: ChatWindowProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAppStore()
  const { 
    messages, 
    input, 
    setInput, 
    sessionId,
    isTyping, 
    isLoading,
    sendMessage, 
    newSession,
  } = useChat()
  
  const { sessions, isLoading: isLoadingSessions, deleteSession } = useChatSessions()
  
  const [showSessionList, setShowSessionList] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Автопрокрутка вниз
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Фокус на input при открытии
  useEffect(() => {
    if (isOpen && inputRef.current && !showSessionList) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, showSessionList])

  // Закрытие по Esc
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSessionList) {
          setShowSessionList(false)
        } else {
          onClose()
        }
      }
    }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose, showSessionList])

  const handleSend = async () => {
    if (!input.trim() || isTyping) return
    await sendMessage(input)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    newSession()
    setShowSessionList(false)
  }

  const handleSelectSession = (selectedSessionId: number) => {
    // В useChat нужно добавить метод selectSession
    // Пока просто закрываем список - выбор сессии происходит через useChat
    setShowSessionList(false)
  }

  const handleDeleteSession = async (e: React.MouseEvent, sessionIdToDelete: number) => {
    e.stopPropagation()
    setIsDeleting(sessionIdToDelete)
    try {
      await deleteSession(sessionIdToDelete)
    } finally {
      setIsDeleting(null)
    }
  }

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
      return date.toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    
    return date.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
    })
  }

  if (!isOpen) return null

  //  Показываем список сессий
  if (showSessionList) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none sm:p-4">
        <div 
          className="absolute inset-0 bg-black/30 sm:hidden pointer-events-auto"
          onClick={() => setShowSessionList(false)}
        />
        
        <div className="relative w-80 h-[600px] max-h-[80vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border flex flex-col pointer-events-auto animate-in slide-in-from-right-10 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface-card rounded-t-2xl">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <MessageSquare size={18} />
              История чатов
            </h3>
            <button 
              onClick={() => setShowSessionList(false)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronLeft size={20} className="text-text-secondary" />
            </button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoadingSessions ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center text-text-secondary py-8 px-4">
                <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Нет истории чатов</p>
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all group relative ${
                    sessionId === session.id
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-white border-border hover:bg-slate-50 hover:border-primary/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 pr-8">
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${
                        sessionId === session.id ? 'text-primary' : 'text-text-primary'
                      }`}>
                        {session.title || 'Новый чат'}
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
                    
                    <button
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      disabled={isDeleting === session.id}
                      className="absolute right-2 top-2 p-1.5 hover:bg-red-100 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      title="Удалить чат"
                    >
                      {isDeleting === session.id 
                        ? <Loader2 size={14} className="animate-spin" /> 
                        : <Trash2 size={14} />
                      }
                    </button>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border bg-slate-50 rounded-b-2xl">
            <Button variant="secondary" size="sm" onClick={handleNewChat} className="w-full">
              <MessageSquarePlus size={16} className="mr-2" />
              Новый чат
            </Button>
          </div>
        </div>
      </div>
    )
  }

  //  Показываем окно чата
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none sm:p-4">
      {/* Затемнение фона */}
      <div 
        className="absolute inset-0 bg-black/30 sm:hidden pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Окно чата */}
      <div className="relative w-full sm:w-96 h-[600px] max-h-[80vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border flex flex-col pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-card rounded-t-2xl">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-text-primary truncate">
                {sessionId ? `Чат #${sessionId}` : 'Новый чат'}
              </h3>
              <p className="text-xs text-text-secondary">
                {isTyping ? 'Печатает...' : sessionId ? 'Онлайн' : 'Начните диалог'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={() => setShowSessionList(true)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors relative"
              title="История чатов"
            >
              <MessageSquare size={18} className="text-text-secondary" />
              {sessions.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
              )}
            </button>
            <button 
              onClick={handleNewChat}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              title="Новый чат"
            >
              <MessageSquarePlus size={18} className="text-text-secondary" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} className="text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface">
          {isLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-text-secondary py-8">
              <Bot size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Начните диалог с ИИ-агентом</p>
              <p className="text-xs mt-1 opacity-70">
                Задайте вопрос о платформе, компаниях или проектах
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div 
                key={msg.id || index} 
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' 
                    ? 'bg-primary/10 text-primary' 
                    : msg.role === 'assistant'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                {/* Message */}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-sm'
                    : 'bg-white border border-border text-text-primary rounded-tl-sm shadow-sm'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.timestamp && (
                    <p className={`text-[10px] mt-1 ${
                      msg.role === 'user' ? 'text-white/70' : 'text-text-secondary'
                    }`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          
          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-white rounded-b-2xl">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Напишите сообщение..."
              rows={1}
              className="flex-1 px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-light text-sm resize-none max-h-32"
              disabled={isTyping || isLoading}
              style={{ minHeight: '44px' }}
            />
            <Button 
              onClick={handleSend} 
              disabled={!input.trim() || isTyping || isLoading}
              size="sm"
              className="px-3 shrink-0"
            >
              {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </Button>
          </div>
          <p className="text-[10px] text-text-secondary mt-2 text-center">
            Enter для отправки • Shift+Enter для новой строки
          </p>
        </div>
      </div>
    </div>
  )
}