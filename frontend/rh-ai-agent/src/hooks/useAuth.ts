import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/endpoints'
import { useAppStore } from '@/store/useAppStore'
import type { UserCreate, UserLogin, UserRead } from '@/api/types'

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false)
  
  const { setAuth, setUser, addToast } = useAppStore()
  const navigate = useNavigate()

  const requestRef = useRef<{ login: boolean; register: boolean }>({
    login: false,
    register: false,
  })

  const register = async (data: UserCreate) => {
    setIsLoading(true)

    try {
      await authApi.register(data)
      
      addToast('Регистрация успешна! Теперь войдите в систему.', 'success')
      
      
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
      const { data: tokenData } = await authApi.login(data)
      
      localStorage.setItem('auth_token', tokenData.access_token)
      
      const { data: userData } = await authApi.me()
      
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