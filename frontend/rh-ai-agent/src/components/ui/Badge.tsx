import { cn } from '@/lib/utils'

interface BadgeProps { variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'; children: React.ReactNode }
export function Badge({ variant = 'default', children }: BadgeProps) {
  const styles: Record<string, string> = {
    default: 'bg-slate-100 text-text-secondary',
    success: 'bg-green-50 text-status-success',
    warning: 'bg-amber-50 text-status-warning',
    danger: 'bg-red-50 text-status-danger',
    info: 'bg-blue-50 text-status-info'
  }
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', styles[variant])}>{children}</span>
}