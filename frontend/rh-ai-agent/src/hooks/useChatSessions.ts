import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/api/endpoints'
import type { ChatSession } from '@/api/types'
import { useAppStore } from '@/store/useAppStore'

export function useChatSessions() {
  const queryClient = useQueryClient()
  const { addToast } = useAppStore()

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['chat', 'sessions'],
    queryFn: async () => {
      try {
        const res = await chatApi.getSessions()
        const data = res.data
        // Бэкенд возвращает { total: N, items: [...] }
        return Array.isArray(data) ? data : (data?.items || [])
      } catch { return [] }
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => chatApi.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
      addToast('Диалог удалён', 'success')
    },
    onError: () => addToast('Не удалось удалить диалог', 'error')
  })

  return {
    sessions,
    isLoading,
    deleteSession: deleteMutation.mutate,
  }
}