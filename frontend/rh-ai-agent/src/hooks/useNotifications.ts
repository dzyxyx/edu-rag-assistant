import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/endpoints'

export function useNotifications() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then(res => res.data),
    refetchInterval: 30000,
    // 🔥 Возвращаем пустой массив, если данных ещё нет
    placeholderData: [],
  })

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // 🔥 Безопасный подсчёт непрочитанных
  const notifications = data || []
  const unreadCount = notifications.filter(n => !n.is_read).length

  return {
    notifications,
    isLoading,
    unreadCount,
    markAllRead: markAllReadMutation.mutate,
  }
}