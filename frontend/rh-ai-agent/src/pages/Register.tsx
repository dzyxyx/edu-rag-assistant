import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BrainCircuit, Mail, Lock, User, CheckCircle2 } from 'lucide-react'

export default function Register() {
  const { register, isLoading } = useAuth()
  
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
  })
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isRegistered, setIsRegistered] = useState(false)
  
  // 🔥 Новое состояние для мгновенной блокировки кнопки
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = () => {
    const errors: Record<string, string> = {}

    if (!formData.email) {
      errors.email = 'Введите email'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Введите корректный email'
    }

    if (!formData.full_name || formData.full_name.trim().length < 2) {
      errors.full_name = 'Введите имя (минимум 2 символа)'
    }

    if (!formData.password) {
      errors.password = 'Введите пароль'
    } else if (formData.password.length < 6) {
      errors.password = 'Пароль должен содержать минимум 6 символов'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    //  Если уже отправляем или идет загрузка — выходим
    if (isSubmitting || isLoading) return
    
    if (!validate()) return

    // 🔥 Блокируем форму МГНОВЕННО (синхронно)
    setIsSubmitting(true)

    try {
      const result = await register({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
      })

      if (result.success) {
        setIsRegistered(true)
      }
    } catch (err) {
      // В случае ошибки разблокируем форму, чтобы можно было повторить
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  // Экран успешной регистрации
  if (isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-4 shadow-lg">
              <BrainCircuit size={32} />
            </div>
            <h1 className="text-2xl font-bold text-text-primary">ПроКомпетенции</h1>
            <p className="text-text-secondary mt-1">AI Agent для проектного обучения</p>
          </div>

          <Card className="p-8 shadow-xl text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            
            <h2 className="text-xl font-bold text-text-primary mb-2">Регистрация успешна!</h2>
            <p className="text-text-secondary mb-6">Ваш аккаунт создан. Теперь войдите в систему.</p>

            <div className="space-y-3">
              <Button asChild className="w-full py-2.5">
                <Link to="/login">Войти в аккаунт</Link>
              </Button>
              <Button variant="secondary" asChild className="w-full py-2.5">
                <Link to="/">На главную</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-4 shadow-lg">
            <BrainCircuit size={32} />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">ПроКомпетенции</h1>
          <p className="text-text-secondary mt-1">AI Agent для проектного обучения</p>
        </div>

        <Card className="p-6 shadow-xl">
          <h2 className="text-xl font-bold text-text-primary mb-6">Создать аккаунт</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">ФИО</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
                  placeholder="Иванов Иван Иванович"
                  disabled={isSubmitting || isLoading}
                />
              </div>
              {validationErrors.full_name && <p className="mt-1 text-xs text-red-500">{validationErrors.full_name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
                  placeholder="user@example.com"
                  disabled={isSubmitting || isLoading}
                />
              </div>
              {validationErrors.email && <p className="mt-1 text-xs text-red-500">{validationErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Пароль</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light text-sm"
                  placeholder="••••••••"
                  disabled={isSubmitting || isLoading}
                />
              </div>
              {validationErrors.password && <p className="mt-1 text-xs text-red-500">{validationErrors.password}</p>}
            </div>

            <Button
              type="submit"
              className="w-full py-2.5"
              // 🔥 Блокируем кнопку, если идет локальная отправка ИЛИ загрузка из хука
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-text-secondary">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Войти</Link>
          </div>
        </Card>
      </div>
    </div>
  )
}