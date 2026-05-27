import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/endpoints'

export function useNotifications() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then(res => res.data),
    refetchInterval: 30000,
    // 🔥 Возвращаем пустой массив, пока данные загружаются
    placeholderData: [],
    // 🔥 Если бэкенд вернёт объект { items: [...] }, извлекаем массив
    select: (data) => {
      // Если данные уже массив — возвращаем его
      if (Array.isArray(data)) return data
      // Если объект с items — возвращаем items
      if (data && typeof data === 'object' && 'items' in data) {
        return (data as any).items
      }
      // Иначе пустой массив
      return []
    }
  })

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // 🔥 Безопасная работа с данными: гарантируем, что notifications — массив
  const notifications = Array.isArray(data) ? data : []
  const unreadCount = notifications.filter((n: any) => !n.is_read).length

  return {
    notifications,
    isLoading,
    unreadCount,
    markAllRead: markAllReadMutation.mutate,
  }
}