import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store/useAppStore'
import { Save, Bell, Mail, Smartphone, User, Building2, Cpu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Settings() {
  const { t } = useTranslation()
  const { locale } = useAppStore()
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    telegram: false
  })

  const handleSave = () => {
    alert(locale === 'ru' ? 'Настройки сохранены!' : 'Settings saved!')
  }

  interface ToggleProps {
    label: string
    description: string
    checked: boolean
    onChange: (checked: boolean) => void
    icon?: React.ReactNode
  }

  function Toggle({ label, description, checked, onChange, icon }: ToggleProps) {
    return (
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          {icon && <div className="text-text-secondary">{icon}</div>}
          <div>
            <p className="text-sm font-medium text-text-primary">{label}</p>
            <p className="text-xs text-text-secondary">{description}</p>
          </div>
        </div>
        <button
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            checked ? 'bg-primary' : 'bg-slate-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              checked ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('settings.title')}</h1>
        <p className="text-text-secondary mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
            <User size={18} className="text-primary" />
            <h3 className="font-bold text-lg text-text-primary">{t('settings.profile')}</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {locale === 'ru' ? 'Имя' : 'First Name'}
                </label>
                <input
                  type="text"
                  defaultValue={locale === 'ru' ? 'Алексей' : 'Alexey'}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {locale === 'ru' ? 'Фамилия' : 'Last Name'}
                </label>
                <input
                  type="text"
                  defaultValue={locale === 'ru' ? 'Иванов' : 'Ivanov'}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
              <input
                type="email"
                defaultValue="admin@urfu.ru"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {locale === 'ru' ? 'Должность' : 'Position'}
              </label>
              <input
                type="text"
                defaultValue={locale === 'ru' ? 'Администратор платформы' : 'Platform Administrator'}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
            <Cpu size={18} className="text-primary" />
            <h3 className="font-bold text-lg text-text-primary">{t('settings.agent')}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {locale === 'ru' ? 'Версия модели' : 'Model Version'}
              </label>
              <select className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm bg-white">
                <option>GPT-4 (OpenAI)</option>
                <option>GigaChat (Sber)</option>
                <option>YandexGPT</option>
                <option>VK AI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {locale === 'ru' ? 'API Ключ интеграции' : 'API Integration Key'}
              </label>
              <input
                type="password"
                defaultValue="sk-••••••••••••••••••••••••"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
            <Building2 size={18} className="text-primary" />
            <h3 className="font-bold text-lg text-text-primary">{t('settings.org')}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {locale === 'ru' ? 'Название организации' : 'Organization Name'}
              </label>
              <input
                type="text"
                defaultValue={locale === 'ru' ? 'Уральский федеральный университет' : 'Ural Federal University'}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {locale === 'ru' ? 'Подразделение / Факультет' : 'Department / Faculty'}
              </label>
              <input
                type="text"
                defaultValue={locale === 'ru' ? 'ИРИТ-РТФ' : 'IRIT-RTF'}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
            <Bell size={18} className="text-primary" />
            <h3 className="font-bold text-lg text-text-primary">{t('settings.notifications')}</h3>
          </div>
          <div className="divide-y divide-border">
            <Toggle
              label={locale === 'ru' ? 'Email уведомления' : 'Email notifications'}
              description={locale === 'ru' ? 'Отчёты о работе агента' : 'Agent performance reports'}
              checked={notifications.email}
              onChange={(v) => setNotifications({ ...notifications, email: v })}
              icon={<Mail size={18} />}
            />
            <Toggle
              label={locale === 'ru' ? 'Push в браузере' : 'Browser Push'}
              description={locale === 'ru' ? 'Срочные запросы агента' : 'Urgent agent requests'}
              checked={notifications.push}
              onChange={(v) => setNotifications({ ...notifications, push: v })}
              icon={<Bell size={18} />}
            />
            <Toggle
              label={locale === 'ru' ? 'Telegram бот' : 'Telegram Bot'}
              description={locale === 'ru' ? 'Дублирование важных' : 'Duplicate important'}
              checked={notifications.telegram}
              onChange={(v) => setNotifications({ ...notifications, telegram: v })}
              icon={<Smartphone size={18} />}
            />
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="px-6">
          <Save size={16} className="mr-2" />
          {t('settings.save')}
        </Button>
      </div>
    </div>
  )
}