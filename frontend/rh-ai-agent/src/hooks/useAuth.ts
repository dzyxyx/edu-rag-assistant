import { useState } from 'react'
import { authApi } from '@/api/endpoints'
import { useAppStore } from '@/store/useAppStore'
import type { UserLogin, TokenResponse, UserRead } from '@/api/types'

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { setAuth, setUser } = useAppStore()

  const login = async (credentials: UserLogin): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await authApi.login(credentials)
      const data: TokenResponse = response.data

      // 🔥 Сохраняем токен
      if (data.access_token) {
        localStorage.setItem('auth_token', data.access_token)
      }

      setAuth({
        userId: '',
        role: 'user',
        token: data.access_token,
      })

      // Загружаем профиль
      try {
        const profileResponse = await authApi.me()
        const userData: UserRead = profileResponse.data
        setUser(userData)
        setAuth(prev => prev ? { ...prev, userId: String(userData.id) } : null)
      } catch (profileErr) {
        console.warn('Failed to load user profile:', profileErr)
      }

      return { success: true }
    } catch (err: any) {
      console.error('Login error:', err)
      
      let message = 'Ошибка при входе'
      if (err.response?.status === 401) {
        message = 'Неверный email или пароль'
      } else if (err.response?.status === 422) {
        message = 'Проверьте правильность заполнения полей'
      } else if (err.message) {
        message = err.message
      }
      
      setError(message)
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }

  // 🔥 Мгновенный логаут: не ждём ответа от бэкенда
  const logout = async () => {
    // 1. Немедленно очищаем локальную сессию
    localStorage.removeItem('auth_token')
    setAuth(null)
    setUser(null)

    // 2. Отправляем запрос на бэкенд в фоне (не ждём ответа)
    // 🔥 Используем AbortController для отмены запроса через 2 секунды
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    try {
      // 🔥 Вызываем логаут с коротким таймаутом
      await authApi.logout()
    } catch (err) {
      // 🔥 Игнорируем ошибки: пользователь уже вышел локально
      console.log('Logout request completed or timed out (ignored)')
    } finally {
      clearTimeout(timeoutId)
    }

    // 3. Редирект на страницу входа (выполняется сразу)
    window.location.href = '/login'
  }

  return {
    login,
    logout,
    isLoading,
    error,
  }
}