import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, User, Loader2, MessageSquarePlus } from 'lucide-react'
import { Button } from './Button'
import { useChat } from '@/hooks/useChat'
import { useTranslation } from 'react-i18next'

interface ChatWindowProps {
  isOpen: boolean
  onClose: () => void
}

export function ChatWindow({ isOpen, onClose }: ChatWindowProps) {
  const { t, i18n } = useTranslation()
  const { 
    messages, 
    input, 
    setInput, 
    sessionId,
    isTyping, 
    isLoading,
    sendMessage, 
    newSession,
    progress 
  } = useChat()
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Автопрокрутка
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Фокус при открытии
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Esc для закрытия
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

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

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none sm:p-4">
      <div 
        className="absolute inset-0 bg-black/30 sm:hidden pointer-events-auto"
        onClick={onClose}
      />
      
      <div className="relative w-full sm:w-96 h-[600px] max-h-[80vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border flex flex-col pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-card rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">ИИ-агент</h3>
              <p className="text-xs text-text-secondary">
                {isTyping ? 'Печатает...' : sessionId ? 'Онлайн' : 'Новый чат'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {sessionId && (
              <button 
                onClick={newSession}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                title="Новый чат"
              >
                <MessageSquarePlus size={18} className="text-text-secondary" />
              </button>
            )}
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
          ) : !Array.isArray(messages) || messages.length === 0 ? (
            <div className="text-center text-text-secondary py-8">
              <Bot size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Начните диалог с ИИ-агентом</p>
              <p className="text-xs mt-1 opacity-70">
                Задайте вопрос о платформе, компаниях или проектах
              </p>
            </div>
          ) : (
            messages.map((msg: any, index: number) => {
              // 🔥 Нормализация времени для каждого сообщения
              const timestamp = msg.timestamp || msg.created_at
              
              return (
                <div 
                  key={msg.id || `msg-${index}`} 
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' 
                      ? 'bg-primary/10 text-primary' 
                      : msg.role === 'assistant'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-tr-sm'
                      : 'bg-white border border-border text-text-primary rounded-tl-sm shadow-sm'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {timestamp && (
                      <p className={`text-[10px] mt-1 ${
                        msg.role === 'user' ? 'text-white/70' : 'text-text-secondary'
                      }`}>
                        {formatTime(timestamp)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
          
          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-text-secondary">
                    {progress > 0 ? `Обработка... ${progress}%` : 'ИИ анализирует вопрос...'}
                  </span>
                </div>
                
                {progress > 0 && (
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div 
                      className="bg-primary h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                )}
                
                <p className="text-[10px] text-text-secondary mt-2 opacity-70">
                  {progress === 0 
                    ? 'Это может занять 1-2 минуты...' 
                    : 'Пожалуйста, не закрывайте окно'}
                </p>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick suggestions */}
        {(!Array.isArray(messages) || messages.length === 0) && !isLoading && (
          <div className="px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {[
                'Что такое ПроКомпетенции?',
                'Как найти партнёра?',
                'Как опубликовать проект?'
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-text-secondary rounded-full whitespace-nowrap transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

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
              className="px-3"
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