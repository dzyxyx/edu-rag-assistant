import { useTranslation } from 'react-i18next'
import { t } from '@/i18n'

interface TranslatableProps {
  children: React.ReactNode
  skip?: boolean  // Пропустить перевод (для названий компаний)
  className?: string
  as?: keyof JSX.IntrinsicElements
}

export function Translatable({ 
  children, 
  skip = false, 
  className = '', 
  as: Component = 'span' 
}: TranslatableProps) {
  const { i18n } = useTranslation()
  
  // Если пропустить перевод — рендерим как есть
  if (skip) {
    return <Component data-i18n="false" className={className}>{children}</Component>
  }
  
  // Если строка — переводим
  if (typeof children === 'string') {
    const trimmed = children.trim()
    if (!trimmed) return <Component className={className}>{children}</Component>
    
    const translated = t(trimmed)
    return <Component className={className}>{translated}</Component>
  }
  
  // Если не строка — рендерим как есть (для вложенных компонентов)
  return <Component className={className}>{children}</Component>
}