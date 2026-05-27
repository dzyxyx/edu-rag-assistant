import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BrainCircuit, Mail, Lock } from 'lucide-react'

export default function Login() {
  const { login, isLoading } = useAuth()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = 'Введите email'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Введите корректный email'
    }

    if (!formData.password) {
      newErrors.password = 'Введите пароль'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isSubmitting || isLoading) return
    
    if (!validate()) return

    setIsSubmitting(true)

    try {
      const result = await login({
        email: formData.email,
        password: formData.password,
      })
      
      if (result.success) {
        navigate('/')
      }
    } catch (err) {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-4 shadow-lg">
            <BrainCircuit size={32} />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">ПроКомпетенции</h1>
          <p className="text-text-secondary mt-1">AI Agent для проектного обучения</p>
        </div>

        {/* Login Form */}
        <Card className="p-6 shadow-xl">
          <h2 className="text-xl font-bold text-text-primary mb-6">Вход в систему</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
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
                  disabled={isSubmitting || isLoading}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Пароль
              </label>
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
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-border" 
                  disabled={isSubmitting || isLoading}
                />
                <span className="text-text-secondary">Запомнить меня</span>
              </label>
              <button 
                type="button" 
                className="text-primary hover:underline"
                disabled={isSubmitting || isLoading}
              >
                Забыли пароль?
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full py-2.5"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? 'Вход...' : 'Войти'}
            </Button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center text-sm text-text-secondary">
            Нет аккаунта?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Зарегистрироваться
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}