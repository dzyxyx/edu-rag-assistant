import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-light disabled:opacity-50 disabled:cursor-not-allowed'
    const variants: Record<string, string> = {
      primary: 'bg-primary hover:bg-primary-hover text-white',
      secondary: 'bg-white border border-border hover:bg-slate-50 text-text-primary',
      ghost: 'hover:bg-slate-100 text-text-secondary'
    }
    const sizes: Record<string, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base'
    }
    return <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />
  }
)
Button.displayName = 'Button'