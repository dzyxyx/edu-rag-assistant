import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, User, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { useTranslation } from 'react-i18next'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface ChatWindowProps {
  isOpen: boolean
  onClose: () => void
}

// 🔥 Заглушки для ответов ИИ
const MOCK_RESPONSES: Record<string, string[]> = {
  default: [
    'Это демо-режим чата. Полноценный ИИ-агент будет доступен после обучения модели.',
    'Я пока учусь! Попробуйте задать вопрос позже, когда модель будет готова.',
    'Спасибо за вопрос! В текущей версии я работаю в режиме заглушки.',
  ],
  greeting: [
    'Привет! 👋 Я ИИ-агент ПроКомпетенции. Чем могу помочь?',
    'Здравствуйте! Готов ответить на вопросы о платформе.',
  ],
  companies: [
    'Для поиска компаний перейдите на вкладку "Поиск компаний". Там вы сможете верифицировать партнёров.',
    'Рекомендую начать с анализа индустрии — это поможет найти релевантных партнёров.',
  ],
  projects: [
    'Проекты создаются автоматически после назначения встречи с компанией.',
    'Чтобы опубликовать проект в LMS, нажмите кнопку "Опубликовать" в карточке проекта.',
  ],
  help: [
    '📚 Доступные команды:\n• /companies — поиск партнёров\n• /projects — управление проектами\n• /help — эта справка',
    'Нажмите на любую вкладку в меню слева, чтобы перейти к соответствующему разделу.',
  ],
}

function getMockResponse(input: string): string {
  const lower = input.toLowerCase().trim()
  
  if (lower.match(/привет|здравствуй|hello|hi/)) {
    return MOCK_RESPONSES.greeting[Math.floor(Math.random() * MOCK_RESPONSES.greeting.length)]
  }
  if (lower.match(/компани|партнёр|поиск|верифик/)) {
    return MOCK_RESPONSES.companies[Math.floor(Math.random() * MOCK_RESPONSES.companies.length)]
  }
  if (lower.match(/проект|публик|lms|студент/)) {
    return MOCK_RESPONSES.projects[Math.floor(Math.random() * MOCK_RESPONSES.projects.length)]
  }
  if (lower.match(/помощь|справк|\/help|команд/)) {
    return MOCK_RESPONSES.help[Math.floor(Math.random() * MOCK_RESPONSES.help.length)]
  }
  
  return MOCK_RESPONSES.default[Math.floor(Math.random() * MOCK_RESPONSES.default.length)]
}

export function ChatWindow({ isOpen, onClose }: ChatWindowProps) {
  const { t, i18n } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Привет! 👋 Я ИИ-агент ПроКомпетенции. Чем могу помочь?\n\n_Это демо-режим. Полноценный ИИ будет доступен после обучения модели._',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Автопрокрутка вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Закрытие по Esc
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // 🔥 Имитация "мышления" ИИ
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200))

    const response: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: getMockResponse(userMessage.content),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, response])
    setIsTyping(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none sm:p-4">
      {/* Затемнение фона на мобильных */}
      <div 
        className="absolute inset-0 bg-black/30 sm:hidden pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Окно чата */}
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
                {isTyping ? 'Печатает...' : 'Онлайн • Демо-режим'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
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
                <p className={`text-[10px] mt-1 ${
                  msg.role === 'user' ? 'text-white/70' : 'text-text-secondary'
                }`}>
                  {msg.timestamp.toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
          
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

        {/* Quick suggestions */}
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['Что такое ПроКомпетенции?', 'Как найти партнёра?', 'Как опубликовать проект?'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion)
                  // Можно сразу отправить: handleSend()
                }}
                className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-text-secondary rounded-full whitespace-nowrap transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-white rounded-b-2xl">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Напишите сообщение..."
              className="flex-1 px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
              disabled={isTyping}
            />
            <Button 
              onClick={handleSend} 
              disabled={!input.trim() || isTyping}
              size="sm"
              className="px-3"
            >
              {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </Button>
          </div>
          <p className="text-[10px] text-text-secondary mt-2 text-center">
            Нажмите Enter для отправки • Shift+Enter для новой строки
          </p>
        </div>
      </div>
    </div>
  )
}