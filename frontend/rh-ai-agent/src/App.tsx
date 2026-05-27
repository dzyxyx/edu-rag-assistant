import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { PlatformBridge } from '@/lib/platform-bridge'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-secondary">Загрузка...</p>
      </div>
    </div>
  )
}

export default function App() {
  const { setAuth, setUser } = useAppStore()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        // 🔥 Проверяем токен в localStorage
        const token = localStorage.getItem('auth_token')
        
        if (token) {
          // Пытаемся получить данные пользователя
          try {
            const { authApi } = await import('@/api/endpoints')
            const { data: userData } = await authApi.me()
            
            setAuth({
              userId: String(userData.id),
              role: 'user',
              token,
            })
            setUser(userData)
          } catch (err) {
            // Токен невалиден - очищаем
            console.warn('Invalid token, clearing...')
            localStorage.removeItem('auth_token')
          }
        }
      } catch (err) {
        console.warn('Auth init failed:', err)
      } finally {
        setIsInitialized(true)
      }
    }

    init()
  }, [setAuth, setUser])

  if (!isInitialized) {
    return <LoadingFallback />
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <ToastContainer />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}