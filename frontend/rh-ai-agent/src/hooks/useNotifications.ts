import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/endpoints'
import { useAppStore } from '@/store/useAppStore'

export function useNotifications() {
  const queryClient = useQueryClient()
  const { addToast } = useAppStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ unread_only: false, limit: 50 }).then(res => res.data),
    staleTime: 30000,
    refetchInterval: 60000,
    select: (data) => {
      if (!data) return { items: [], total: 0, unread: 0 }
      return {
        items: Array.isArray(data.items) ? data.items : [],
        total: data.total || 0,
        unread: data.unread || 0,
      }
    }
  })

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => {
      addToast('Не удалось отметить уведомление', 'error')
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      addToast('Все уведомления отмечены как прочитанные', 'success')
    },
    onError: () => {
      addToast('Не удалось отметить уведомления', 'error')
    },
  })

  const notifications = data?.items || []
  const unreadCount = data?.unread || 0

  return {
    notifications,
    isLoading,
    unreadCount,
    markAllRead: markAllReadMutation.mutate,
    markAsRead: markAsReadMutation.mutate,
    refetch,
  }
}