import { cn } from '@/lib/utils'
import { type HTMLAttributes, forwardRef } from 'react'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('bg-surface-card rounded-xl border border-border shadow-card p-5', className)} {...props} />
  )
)
Card.displayName = 'Card'