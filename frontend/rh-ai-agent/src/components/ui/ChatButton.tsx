import { MessageSquare } from 'lucide-react'
import { Button } from './Button'

interface ChatButtonProps {
  onClick: () => void
  hasUnread?: boolean
}

export function ChatButton({ onClick, hasUnread = false }: ChatButtonProps) {
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={onClick}
      className="h-8 w-8 p-0 relative"
      title="Чат с ИИ-агентом"
    >
      <MessageSquare size={20} className="text-text-secondary" />
      {hasUnread && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white animate-pulse" />
      )}
    </Button>
  )
}