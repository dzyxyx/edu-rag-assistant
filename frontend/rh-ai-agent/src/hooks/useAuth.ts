import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/endpoints'
import { useAppStore } from '@/store/useAppStore'
import type { UserCreate, UserLogin, UserRead } from '@/api/types'

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false)
  
  // 🔥 Извлекаем все нужные функции из стейта
  const { setAuth, setUser, addToast } = useAppStore()
  const navigate = useNavigate()

  const register = async (data: UserCreate) => {
    setIsLoading(true)

    try {
      // Отправляем данные на бэкенд
      await authApi.register(data)
      
      // 🔥 Показываем тост, но НЕ редиректим
      addToast('Регистрация успешна! Теперь войдите в систему.', 'success')
      
      // Возвращаем успех — компонент Register сам решит, что показать
      return { success: true }
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Ошибка регистрации'
      addToast(message, 'error')
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (data: UserLogin) => {
    setIsLoading(true)

    try {
      // 1. Получаем токен
      const { data: tokenData } = await authApi.login(data)
      
      localStorage.setItem('auth_token', tokenData.access_token)
      
      // 2. Получаем данные пользователя
      const { data: userData } = await authApi.me()
      
      // 3. Сохраняем в стейт
      setAuth({
        userId: String(userData.id),
        role: 'user',
        token: tokenData.access_token,
      })
      
      setUser(userData)
      
      addToast('Вход выполнен!', 'success')
      navigate('/')
      
      return { success: true }
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Неверный email или пароль'
      addToast(message, 'error')
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    setAuth(null)
    setUser(null)
    navigate('/login')
    addToast('Вы вышли из системы', 'info')
  }

  return {
    register,
    login,
    logout,
    isLoading,
  }
}