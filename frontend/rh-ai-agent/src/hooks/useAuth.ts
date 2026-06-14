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

      if (data.access_token) {
        localStorage.setItem('auth_token', data.access_token)
      }

      setAuth({
        userId: '',
        role: 'user',
        token: data.access_token,
      })

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

  const logout = async () => {
    localStorage.removeItem('auth_token')
    setAuth(null)
    setUser(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    try {
      await authApi.logout()
    } catch (err) {
      console.log('Logout request completed or timed out (ignored)')
    } finally {
      clearTimeout(timeoutId)
    }

    window.location.href = '/login'
  }

  return {
    login,
    logout,
    isLoading,
    error,
  }
}