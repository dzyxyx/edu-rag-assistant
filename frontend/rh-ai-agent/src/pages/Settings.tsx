import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { User, Mail, Building, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { user, setUser, agentConfig, setTone, addToast } = useAppStore()
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    organization: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  // Загружаем данные пользователя при монтировании
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        organization: '', // TODO: добавить в бэкенд
      })
    }
  }, [user])

  const handleSaveProfile = async () => {
    setIsLoading(true)
    
    try {
      // TODO: API call to update user profile
      // await authApi.updateProfile(formData)
      
      // Временно обновляем локально
      if (user) {
        setUser({
          ...user,
          full_name: formData.full_name,
          email: formData.email,
        })
      }
      
      addToast('Профиль сохранён', 'success')
    } catch (err) {
      addToast('Ошибка сохранения профиля', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('settings.title')}</h1>
        <p className="text-text-secondary mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Профиль пользователя */}
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <User size={20} />
            {t('settings.profile')}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                ФИО
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
                  placeholder="Иванов Иван Иванович"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
                  placeholder="user@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Организация
              </label>
              <div className="relative">
                <Building size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
                  placeholder="УрФУ"
                />
              </div>
            </div>

            <Button onClick={handleSaveProfile} disabled={isLoading} className="w-full">
              <Save size={16} className="mr-2" />
              {isLoading ? 'Сохранение...' : t('settings.save')}
            </Button>
          </div>
        </Card>

        {/* Настройки ИИ-агента */}
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            {t('settings.agent')}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Тон коммуникации
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTone('formal')}
                  className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
                    agentConfig.tone === 'formal'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-secondary border-border hover:bg-slate-50'
                  }`}
                >
                  {t('communications.formal')}
                </button>
                <button
                  onClick={() => setTone('informal')}
                  className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
                    agentConfig.tone === 'informal'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-secondary border-border hover:bg-slate-50'
                  }`}
                >
                  {t('communications.informal')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Модель ИИ
              </label>
              <input
                type="text"
                value={agentConfig.model}
                disabled
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-slate-50 text-text-secondary text-sm"
              />
              <p className="text-xs text-text-secondary mt-1">
                Модель выбирается автоматически
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}