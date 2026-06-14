import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'

export function LanguageToggle() {
  const { i18n } = useTranslation()
  
  return (
    <button
      onClick={() => i18n.changeLanguage(i18n.language === 'ru' ? 'en' : 'ru')}
      className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-slate-50 transition-colors"
    >
      <Globe size={16} />
      <span className="font-medium">{i18n.language.toUpperCase()}</span>
    </button>
  )
}