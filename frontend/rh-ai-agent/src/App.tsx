import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { PlatformBridge } from '@/lib/platform-bridge'
import { ToastContainer } from '@/components/ui/ToastContainer'

const queryClient = new QueryClient()

export default function App() {
  const { setAuth } = useAppStore()
  useEffect(() => {
    PlatformBridge.init().then(setAuth).catch(console.error)
  }, [setAuth])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastContainer />
    </QueryClientProvider>
  )
}