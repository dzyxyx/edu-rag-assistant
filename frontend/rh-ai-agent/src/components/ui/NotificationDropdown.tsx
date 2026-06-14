import { useNotifications } from '@/hooks/useNotifications'
import { Badge } from './Badge'
import { Button } from './Button'
import { CheckCheck, Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface NotificationDropdownProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const { i18n } = useTranslation()
  const { notifications, isLoading, unreadCount, markAsRead, markAllRead } = useNotifications()

  if (!isOpen) return null

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-border z-50 overflow-hidden">
      <div className="p-3 border-b border-border bg-slate-50 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-text-primary flex items-center gap-2">
          <Bell size={16} />
          Уведомления
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
          )}
        </h3>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 px-2 text-xs">
            <CheckCheck size={14} className="mr-1" />
            Прочитать все
          </Button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-sm text-text-secondary">
            Нет уведомлений
          </div>
        ) : (
          notifications.map((notification) => (
            <div 
              key={notification.id}
              className={`p-3 border-b border-border hover:bg-slate-50 transition-colors ${
                !notification.is_read ? 'bg-blue-50/50' : ''
              }`}
              onClick={() => markAsRead(notification.id)}
            >
              <div className="flex items-start gap-2">
                {!notification.is_read && (
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${notification.is_read ? 'text-text-secondary' : 'font-medium text-text-primary'}`}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-[10px] text-text-secondary mt-2">
                    {new Date(notification.created_at).toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}