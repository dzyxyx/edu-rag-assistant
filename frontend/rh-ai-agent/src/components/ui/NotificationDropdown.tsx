import { useEffect, useRef } from 'react'
import { useNotifications } from '@/hooks/useNotifications'  //  Используем хук
import { useTranslation } from 'react-i18next'
import { CheckCheck, Bell, AlertTriangle, MessageSquare, Send, Clock } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function NotificationDropdown({ isOpen, onClose }: Props) {
  const { t } = useTranslation()
  
  const { notifications, markAllRead, unreadCount } = useNotifications()
  
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const typeIcons: Record<string, JSX.Element> = {
    escalation: <AlertTriangle size={16} className="text-amber-500" />,
    followup: <Clock size={16} className="text-blue-500" />,
    response: <MessageSquare size={16} className="text-green-500" />,
    system: <Bell size={16} className="text-slate-500" />
  }

  //  Безопасная проверка: notifications может быть пустым массивом
  const safeNotifications = notifications || []
  const safeUnreadCount = unreadCount || 0

  return (
    <div 
      ref={ref}
      className={`absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-border z-50 transition-all duration-200 ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
    >
      <div className="p-3 border-b border-border flex justify-between items-center bg-slate-50 rounded-t-xl">
        <h3 className="font-semibold text-sm text-text-primary flex items-center gap-2">
          <Bell size={16} /> {t('notifications.title')}
          {safeUnreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {safeUnreadCount}
            </span>
          )}
        </h3>
        {safeUnreadCount > 0 && (
          <button 
            onClick={markAllRead} 
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <CheckCheck size={12} /> {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {safeNotifications.length === 0 ? (
          <div className="p-6 text-center text-text-secondary text-sm">
            {t('notifications.empty')}
          </div>
        ) : (
          safeNotifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.is_read && markAllRead()}
              className={`w-full text-left p-3 border-b border-border last:border-0 hover:bg-slate-50 transition-colors flex gap-3 ${!n.is_read ? 'bg-blue-50/50' : ''}`}
            >
              <div className="mt-1 shrink-0">
                {typeIcons[n.type] || typeIcons.system}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.is_read ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                  {t(n.i18nKey, n.params || {})}
                </p>
                <p className="text-xs text-gray-400 mt-1">{n.timestamp}</p>
              </div>
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}
            </button>
          ))
        )}
      </div>
    </div>
  )
}